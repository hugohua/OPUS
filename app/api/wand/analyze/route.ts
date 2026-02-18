import { auth } from "@/auth";
import { streamText } from "ai";
import { z } from "zod";
import { ProviderRegistry } from "@/lib/ai/providers";
import { WandPrompts } from "@/lib/generators/wand-prompts";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:wand:analyze");

// Input Schema
const AnalyzeSchema = z.object({
    text: z.string().min(1),
    type: z.enum(["word", "sentence"]),
    context: z.string().optional(), // For word mode context sentence
});

export async function POST(req: Request) {
    try {
        // 1. Auth Check
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 2. Parse Input
        const json = await req.json();
        const { text, type, context } = AnalyzeSchema.parse(json);

        // 3. Generate Prompt
        let promptData;
        if (type === "word") {
            if (!context) {
                return new Response("Context is required for word mode", { status: 400 });
            }
            promptData = WandPrompts.word(text, context);
        } else {
            promptData = WandPrompts.sentence(text);
        }

        // 4. Select Model (Fast Mode)
        const providers = ProviderRegistry.getFailoverList("fast");
        if (providers.length === 0) {
            throw new Error("No AI providers available");
        }

        const primaryConfig = providers[0];
        const model = ProviderRegistry.createModel(primaryConfig);

        log.info({ type, text, provider: primaryConfig.id }, "Starting Magic Wand analysis");

        // 5. Stream Response (SSE — 统一协议，与 useSSEStream 对齐)
        const result = streamText({
            model,
            system: promptData.system,
            prompt: promptData.user,
            temperature: 0.3,
            async onFinish({ text: generatedText }) {
                log.info({ type, length: generatedText.length }, "Analysis complete");
            },
        });

        // 转换为 SSE 格式: data: {"type":"content","data":"..."}\n\n
        const encoder = new TextEncoder();
        const sseStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.textStream) {
                        const sseEvent = `data: ${JSON.stringify({ type: "content", data: chunk })}\n\n`;
                        controller.enqueue(encoder.encode(sseEvent));
                    }
                    // 发送完成信号
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                    controller.close();
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : "Stream error";
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(sseStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        });

    } catch (error) {
        log.error({ error }, "Magic Wand analysis failed");
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
