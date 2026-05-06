import { streamText } from "ai";

import { ProviderRegistry } from "@/lib/ai/providers";
import { db } from "@/lib/db";
import { WandPrompts } from "@/lib/generators/wand-prompts";
import { WandWordOutputSchema } from "@/lib/validations/weaver-wand-schemas";

export async function lookupWandWord(word: string) {
    const vocab = await db.vocab.findFirst({
        where: {
            word: {
                equals: word,
                mode: "insensitive",
            },
        },
        select: {
            id: true,
            phoneticUk: true,
            definition_cn: true,
            etymology: {
                select: {
                    mode: true,
                    memory_hook: true,
                    data: true,
                },
            },
        },
    });

    if (!vocab) return null;

    const response = {
        vocab: {
            phonetic: vocab.phoneticUk || "",
            meaning: vocab.definition_cn || "",
        },
        etymology: vocab.etymology ? {
            mode: vocab.etymology.mode,
            memory_hook: vocab.etymology.memory_hook,
            data: Object.fromEntries(
                Object.entries((vocab.etymology.data ?? {}) as Record<string, unknown>).map(([key, value]) => [
                    key,
                    typeof value === "string" ? value : JSON.stringify(value),
                ])
            ),
        } : null,
        ai_insight: null,
    };

    return WandWordOutputSchema.parse(response);
}

export function createWandAnalyzeStreamJob(input: {
    text: string;
    type: "word" | "sentence";
    context?: string;
}) {
    const promptData = input.type === "word"
        ? WandPrompts.word(input.text, input.context ?? "")
        : WandPrompts.sentence(input.text);

    const providers = ProviderRegistry.getFailoverList("fast");
    if (providers.length === 0) {
        throw new Error("No AI providers available");
    }

    const model = ProviderRegistry.createModel(providers[0]);
    const encoder = new TextEncoder();
    const result = streamText({
        model,
        system: promptData.system,
        prompt: promptData.user,
        temperature: 0.3,
    });

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of result.textStream) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", data: chunk })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            } catch (error) {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Stream error" })}\n\n`
                    )
                );
            } finally {
                controller.close();
            }
        },
    });
}
