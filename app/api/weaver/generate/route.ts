import { z } from "zod";
import { auth } from "@/auth";
import { createLogger } from '@/lib/logger';

const log = createLogger('api:weaver:generate');
import { handleOpenAIStream, buildMessages } from "@/lib/streaming/sse";
import {
    WEAVER_SYSTEM_PROMPT,
    buildWeaverUserPrompt,
    WeaverFlavorSchema
} from "@/lib/generators/l3/weaver-generator";

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        const json = await req.json();
        const { targetId, flavor, anchorWord } = z.object({
            targetId: z.number(),
            flavor: WeaverFlavorSchema,
            anchorWord: z.string(),
            anchorScenario: z.string().optional()
        }).parse(json);

        // Fetch Target Word
        const { prisma } = await import("@/lib/db");
        const target = await prisma.vocab.findUnique({
            where: { id: targetId },
            select: { word: true }
        });

        if (!target) return new Response("Target not found", { status: 404 });

        // Build Prompt
        const userPrompt = buildWeaverUserPrompt({
            targetWord: target.word,
            anchorWord: anchorWord,
            flavor: flavor
        });

        // 使用通用 SSE 工具（tuoye 模式）
        const messages = buildMessages(userPrompt, WEAVER_SYSTEM_PROMPT);

        return handleOpenAIStream(messages, {
            model: process.env.QWEN_MODEL_NAME || "qwen-plus",
            temperature: 0.7,
            errorContext: "WeaverLab Generation",
            // 可选: 添加回调用于日志或指标收集
            onComplete: (text) => {
                log.info({ word: target.word, length: text.length }, 'Story generated');
            }
        });

    } catch (error) {
        log.error({ error }, 'Weaver request error');
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
