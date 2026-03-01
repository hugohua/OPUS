/**
 * 错题 AI 诊断 — SSE 流式 API Route
 * [V3.1] Cache-First + streamText + SSE 协议（与 useSSEStream 对齐）
 * 
 * 命中缓存 → 单次推送完整 Markdown → done
 * 未命中 → streamText 逐 token 流式推送 → onFinish 写回缓存
 */

import { auth } from "@/auth";
import { streamText } from "ai";
import { prisma } from "@/lib/db";
import { ProviderRegistry } from "@/lib/ai/providers";
import { buildMistakeDiagnosticPrompt } from "@/lib/generators/l2/mistake-diagnostic";
import { createLogger } from "@/lib/logger";
import type { InteractionSegment, TextSegment, BriefingPayload } from "@/types/briefing";

const log = createLogger("api:diagnostic");

export async function POST(req: Request) {
    try {
        // 1. Auth
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 2. 解析入参
        const { mistakeId } = await req.json();
        if (!mistakeId || typeof mistakeId !== "string") {
            return new Response("Missing mistakeId", { status: 400 });
        }

        // 3. 查询错题记录
        const record = await prisma.userMistakeBook.findUnique({
            where: { id: mistakeId, userId: session.user.id }
        });

        if (!record) {
            return new Response("Record not found", { status: 404 });
        }

        const encoder = new TextEncoder();

        // 4. Cache-First：命中缓存直接推送完整 Markdown
        if (record.diagnosticMarkdown) {
            log.info({ mistakeId }, "诊断缓存命中，直接返回");
            const sseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", data: record.diagnosticMarkdown })}\n\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                    controller.close();
                }
            });
            return new Response(sseStream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            });
        }

        // 5. Cache Miss：提取 Prompt 上下文
        const snapshot = record.snapshot as unknown as BriefingPayload;

        let questionText = snapshot.passage_markdown || "";
        const interaction = snapshot.segments?.find((s) => s.type === 'interaction') as InteractionSegment | undefined;

        if (!questionText) {
            if (interaction && interaction.task && 'question_markdown' in interaction.task) {
                questionText = interaction.task.question_markdown;
            } else {
                const txtSeg = snapshot.segments?.find((s) => s.type === 'text') as TextSegment | undefined;
                questionText = txtSeg?.content_markdown || "Context lost";
            }
        }

        // 提取完整选项列表
        let allOptions: string | undefined;
        if (interaction?.task?.options && Array.isArray(interaction.task.options)) {
            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            allOptions = interaction.task.options
                .map((opt: any, i: number) => {
                    const text = typeof opt === 'string' ? opt : (opt.text || opt);
                    return `(${labels[i] || i + 1}) ${text}`;
                })
                .join(' ');
        }

        // 6. 构建 Prompt
        const { systemPrompt, userPrompt } = buildMistakeDiagnosticPrompt(
            questionText,
            record.userWrongAnswer,
            record.correctAnswer,
            allOptions
        );

        // 7. 选择模型
        const providers = ProviderRegistry.getFailoverList("fast");
        if (providers.length === 0) {
            throw new Error("No AI providers available");
        }
        const primaryConfig = providers[0];
        const model = ProviderRegistry.createModel(primaryConfig);

        log.info({ mistakeId, provider: primaryConfig.id }, "开始流式诊断生成");

        // 8. streamText 流式生成
        const result = streamText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.3,
            async onFinish({ text: generatedText }) {
                // 异步写回缓存（fire-and-forget）
                prisma.userMistakeBook.update({
                    where: { id: mistakeId },
                    data: { diagnosticMarkdown: generatedText }
                }).then(() => {
                    log.info({ mistakeId }, "诊断 Markdown 已缓存");
                }).catch((err) => {
                    log.error({ err }, "诊断缓存写回失败");
                });
            },
        });

        // 9. 转换为 SSE 格式
        const sseStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.textStream) {
                        const sseEvent = `data: ${JSON.stringify({ type: "content", data: chunk })}\n\n`;
                        controller.enqueue(encoder.encode(sseEvent));
                    }
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
        log.error({ error }, "诊断 API 错误");
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
