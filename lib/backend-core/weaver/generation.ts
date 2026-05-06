import crypto from "crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { prisma } from "@/lib/db";
import { WEAVER_SCENARIO_MAP } from "@/lib/constants/weaver-scenario-map";
import {
    WEAVER_CONTEXT_SYSTEM_PROMPT,
    buildWeaverContextUserPrompt,
    type WeaverDensity,
} from "@/lib/generators/l2/weaver-context";
import { createLogger } from "@/lib/logger";
import { redis } from "@/lib/queue/connection";
import { recordAudit } from "@/lib/services/audit-service";
import { buildMessages } from "@/lib/streaming/sse";
import { getWeaverIngredientsForUser } from "./selection";

const log = createLogger("backend-core:weaver:generation");

export type WeaverGenerationInput = {
    scenario: string;
    density: WeaverDensity;
    targetWordIds: number[];
};

export type WeaverGenerationCandidate = {
    id: number;
    word: string;
    definition_cn: string;
    pos?: string;
};

export type WeaverCachedGenerationJob = {
    kind: "cached";
    articleId: string;
    content: string;
    headers: Record<string, string>;
};

export type WeaverGenerateJob = {
    kind: "generate";
    articleId: string;
    messages: ChatCompletionMessageParam[];
    model: string;
    temperature: number;
    errorContext: string;
    headers: Record<string, string>;
    onComplete: (text: string) => Promise<void>;
};

export type WeaverGenerationJob = WeaverCachedGenerationJob | WeaverGenerateJob;

export async function createWeaverGenerationJobForUser(
    userId: string,
    input: WeaverGenerationInput
): Promise<WeaverGenerationJob> {
    const { scenario, density, targetWordIds } = input;

    const userExists = await prisma.user.count({ where: { id: userId } });
    if (!userExists) {
        throw new Error("User not found");
    }

    const sortedIds = targetWordIds.slice().sort((left, right) => left - right).join(",");
    const rawKey = `${userId}|${scenario}|${density}|${sortedIds}`;
    const cacheKey = `weaver:cache:${crypto.createHash("md5").update(rawKey).digest("hex")}`;

    const cachedDataStr = await redis.get(cacheKey);
    if (cachedDataStr) {
        try {
            const cachedData = JSON.parse(cachedDataStr) as { content: string; articleId: string };
            return {
                kind: "cached",
                articleId: cachedData.articleId,
                content: cachedData.content,
                headers: {
                    "X-Weaver-Id": cachedData.articleId,
                    "X-Weaver-Cache": "HIT",
                },
            };
        } catch (error) {
            log.error({ error }, "Failed to parse Weaver generation cache");
        }
    }

    const articleId = crypto.randomUUID();
    const candidates = await loadCandidates(userId, scenario, targetWordIds);
    const isFreeReadingMode = candidates.length === 0;

    recordAudit({
        targetWord: scenario,
        contextMode: "WEAVER:GENERATION",
        userId,
        payload: {
            context: {
                scenario,
                density,
                candidateCount: candidates.length,
                isFreeReadingMode,
                type: "mobile_weaver_start_gen",
            },
        },
    });

    const dbScenarios = WEAVER_SCENARIO_MAP[scenario] || [];
    const specificContext = dbScenarios.length > 0
        ? dbScenarios[Math.floor(Math.random() * dbScenarios.length)]
        : "general_business";

    const messages = buildMessages(
        buildWeaverContextUserPrompt({
            targetWords: candidates,
            scenario,
            subContext: specificContext,
            density,
        }),
        WEAVER_CONTEXT_SYSTEM_PROMPT
    );
    const genStartTime = Date.now();

    return {
        kind: "generate",
        articleId,
        messages,
        model: process.env.QWEN_MODEL_NAME || "qwen-plus",
        temperature: 0.7,
        errorContext: "Mobile Weaver Generation",
        headers: {
            "X-Weaver-Id": articleId,
            "X-Weaver-Cache": "MISS",
        },
        onComplete: async (text) => {
            const title = extractTitle(text, scenario);

            try {
                await prisma.$transaction(async (tx) => {
                    await tx.article.create({
                        data: {
                            id: articleId,
                            userId,
                            title,
                            body: {
                                content: text,
                                context: {
                                    scenarioId: scenario,
                                    density,
                                },
                            },
                            summaryZh: "",
                        },
                    });

                    if (candidates.length > 0) {
                        await tx.articleVocab.createMany({
                            data: candidates.map((candidate) => ({
                                articleId,
                                vocabId: candidate.id,
                                role: "TARGET",
                            })),
                        });
                    }
                });
            } catch (error) {
                log.error({ error }, "Failed to save Weaver generated article");
                return;
            }

            try {
                await redis.set(
                    cacheKey,
                    JSON.stringify({ content: text, articleId }),
                    "EX",
                    3600
                );
            } catch (error) {
                log.error({ error }, "Failed to write Weaver generation cache");
            }

            recordAudit({
                targetWord: scenario,
                contextMode: "WEAVER:GENERATION",
                userId,
                payload: {
                    context: {
                        scenario,
                        density,
                        latencyMs: Date.now() - genStartTime,
                        wordCount: text.length,
                        candidateCount: candidates.length,
                        type: "mobile_weaver_complete_gen",
                    },
                },
            });
        },
    };
}

async function loadCandidates(
    userId: string,
    scenario: string,
    targetWordIds: number[]
): Promise<WeaverGenerationCandidate[]> {
    if (targetWordIds.length > 0) {
        const manualRaw = await prisma.vocab.findMany({
            where: { id: { in: targetWordIds } },
            select: { id: true, word: true, definition_cn: true, partOfSpeech: true },
        });

        return manualRaw.map((item) => ({
            id: item.id,
            word: item.word,
            definition_cn: item.definition_cn || "",
            pos: item.partOfSpeech || undefined,
        }));
    }

    const result = await getWeaverIngredientsForUser(userId, scenario, false);
    if (result.status !== "success" || !result.data) {
        return [];
    }

    return [
        ...result.data.priorityWords.map((item) => ({
            id: item.id,
            word: item.word,
            definition_cn: item.meaning,
        })),
        ...result.data.fillerWords.map((item) => ({
            id: item.id,
            word: item.word,
            definition_cn: item.meaning,
        })),
    ];
}

function extractTitle(text: string, scenario: string): string {
    const titleMatch = text.match(/===TITLE===\s*([\s\S]*?)\s*===BODY===/);
    const fallback = `${scenario} - ${new Date().toISOString().split("T")[0]}`;
    return (titleMatch ? titleMatch[1].trim() : fallback)
        .replace(/\*\*/g, "")
        .replace(/#+/g, "")
        .trim();
}
