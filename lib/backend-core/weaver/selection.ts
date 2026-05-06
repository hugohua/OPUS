import { z } from "zod";

import { prisma } from "@/lib/db";
import { redis } from "@/lib/queue/connection";
import { auditWeaverSelection } from "@/lib/services/audit-service";
import { getDbScenariosForWeaver, WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenario-map";
import { buildNotMasteredVocabWhere } from "@/lib/vocab-state/filters";
import { type ActionState } from "@/types/action";

const TARGET_PRIORITY = 10;
const TARGET_FILLER = 4;

const WeaverSelectionSchema = z.object({
    userId: z.string().min(1),
    scenario: z.enum(WEAVER_SCENARIOS as [string, ...string[]]),
});

export type WeaverIngredientWord = {
    id: number;
    word: string;
    meaning: string;
    source?: string;
};

export type WeaverIngredients = {
    priorityWords: Array<WeaverIngredientWord & { source: string }>;
    fillerWords: WeaverIngredientWord[];
};

export async function getWeaverIngredientsForUser(
    userId: string,
    scenario: string,
    forceRefresh = false
): Promise<ActionState<WeaverIngredients>> {
    try {
        const validated = WeaverSelectionSchema.parse({ userId, scenario });
        const dbScenarios = getDbScenariosForWeaver(validated.scenario);
        const timeWindow = Math.floor(Date.now() / 30000);
        const cacheKey = `weaver:ingredients:${validated.userId}:${validated.scenario}:${forceRefresh ? "manual_" + Date.now() : timeWindow}`;

        if (!forceRefresh) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return {
                    status: "success",
                    message: "Loaded from cache",
                    data: JSON.parse(cached),
                };
            }
        }

        const collectedIds = new Set<number>();
        const priorityWords: WeaverIngredients["priorityWords"] = [];

        if (dbScenarios.length > 0) {
            const dueMatchedPool = await prisma.userProgress.findMany({
                where: {
                    userId: validated.userId,
                    status: { in: ["LEARNING", "REVIEW"] },
                    next_review_at: { lte: new Date() },
                    track: "CONTEXT",
                    vocab: {
                        ...buildNotMasteredVocabWhere(validated.userId),
                        scenarios: { hasSome: dbScenarios },
                    },
                },
                take: 50,
                orderBy: { next_review_at: "asc" },
                select: {
                    vocab: { select: { id: true, word: true, definition_cn: true } },
                },
            });

            for (const progress of shuffle(dueMatchedPool).slice(0, TARGET_PRIORITY)) {
                if (!collectedIds.has(progress.vocab.id)) {
                    collectedIds.add(progress.vocab.id);
                    priorityWords.push({
                        id: progress.vocab.id,
                        word: progress.vocab.word,
                        meaning: progress.vocab.definition_cn || "",
                        source: "due_matched",
                    });
                }
            }
        }

        if (priorityWords.length < TARGET_PRIORITY && dbScenarios.length > 0) {
            const remaining = TARGET_PRIORITY - priorityWords.length;
            const newMatchedPool = await prisma.vocab.findMany({
                where: {
                    scenarios: { hasSome: dbScenarios },
                    ...buildNotMasteredVocabWhere(validated.userId),
                    progress: { none: { userId: validated.userId } },
                    id: { notIn: [...collectedIds] },
                },
                take: 50,
                orderBy: { frequency_score: "desc" },
                select: { id: true, word: true, definition_cn: true },
            });

            for (const vocab of shuffle(newMatchedPool).slice(0, remaining)) {
                if (!collectedIds.has(vocab.id)) {
                    collectedIds.add(vocab.id);
                    priorityWords.push({
                        id: vocab.id,
                        word: vocab.word,
                        meaning: vocab.definition_cn || "",
                        source: "new_matched",
                    });
                }
            }
        }

        if (priorityWords.length < TARGET_PRIORITY) {
            const remaining = TARGET_PRIORITY - priorityWords.length;
            const dueFallbackPool = await prisma.userProgress.findMany({
                where: {
                    userId: validated.userId,
                    status: { in: ["LEARNING", "REVIEW"] },
                    next_review_at: { lte: new Date() },
                    track: "CONTEXT",
                    vocabId: { notIn: [...collectedIds] },
                    vocab: buildNotMasteredVocabWhere(validated.userId),
                },
                take: 50,
                orderBy: { next_review_at: "asc" },
                select: {
                    vocab: { select: { id: true, word: true, definition_cn: true } },
                },
            });

            for (const progress of shuffle(dueFallbackPool).slice(0, remaining)) {
                if (!collectedIds.has(progress.vocab.id)) {
                    collectedIds.add(progress.vocab.id);
                    priorityWords.push({
                        id: progress.vocab.id,
                        word: progress.vocab.word,
                        meaning: progress.vocab.definition_cn || "",
                        source: "due_fallback",
                    });
                }
            }
        }

        const fillerWhere: any = {
            userId: validated.userId,
            state: 2,
            stability: { gte: 30 },
            vocabId: { notIn: [...collectedIds] },
        };

        if (dbScenarios.length > 0) {
            fillerWhere.vocab = { scenarios: { hasSome: dbScenarios } };
        }

        const fillerRaw = await prisma.userProgress.findMany({
            where: fillerWhere,
            take: TARGET_FILLER,
            orderBy: { stability: "desc" },
            select: {
                vocab: {
                    select: { id: true, word: true, definition_cn: true },
                },
            },
        });

        const fillerWords = fillerRaw.map((progress) => ({
            id: progress.vocab.id,
            word: progress.vocab.word,
            meaning: progress.vocab.definition_cn || "",
        }));

        const resultData = { priorityWords, fillerWords };
        await redis.setex(cacheKey, 30, JSON.stringify(resultData));

        auditWeaverSelection(validated.userId, validated.scenario, {
            priorityCount: priorityWords.length,
            fillerCount: fillerWords.length,
            priorityIds: priorityWords.map((word) => word.id),
            fillerIds: fillerWords.map((word) => word.id),
        });

        return {
            status: "success",
            message: `Loaded ${priorityWords.length} priority + ${fillerWords.length} filler`,
            data: resultData,
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                status: "error",
                message: "Invalid parameters",
                fieldErrors: error.flatten().fieldErrors as Record<string, string>,
            };
        }

        return {
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}

function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
