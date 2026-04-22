import crypto from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { redis } from "@/lib/queue/connection";
import { createLogger } from "@/lib/logger";
import { recordAudit } from "@/lib/services/audit-service";
import { handleOpenAIStream, buildMessages } from "@/lib/streaming/sse";
import { createMobileErrorEnvelope, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getWeaverIngredients } from "@/actions/weaver-selection";
import { WEAVER_DENSITY_IDS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";
import { WEAVER_SCENARIO_MAP } from "@/lib/constants/weaver-scenario-map";
import {
    WEAVER_CONTEXT_SYSTEM_PROMPT,
    buildWeaverContextUserPrompt,
} from "@/lib/generators/l2/weaver-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("api:mobile:weaver");

const MobileWeaverGenerateSchema = z.object({
    scenario: z.enum(WEAVER_SCENARIOS.map(({ id }) => id) as [string, ...string[]]),
    density: z.enum(WEAVER_DENSITY_IDS),
    targetWordIds: z.array(z.number()).default([]),
});

export async function POST(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    let json: unknown;
    try {
        json = await request.json();
    } catch {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "Invalid JSON body"),
            { status: 400 }
        );
    }

    const validated = MobileWeaverGenerateSchema.safeParse(json);
    if (!validated.success) {
        return Response.json(
            createMobileErrorEnvelope(
                "VALIDATION_ERROR",
                "Validation failed",
                Object.fromEntries(
                    Object.entries(validated.error.flatten().fieldErrors).map(([key, value]) => [key, value?.[0] ?? ""])
                )
            ),
            { status: 400 }
        );
    }

    try {
        const userId = session.user.id;
        const { scenario, density, targetWordIds } = validated.data;

        const userExists = await prisma.user.count({ where: { id: userId } });
        if (!userExists) {
            return mobileUnauthorizedResponse("User not found");
        }

        const sortedIds = targetWordIds.slice().sort((left, right) => left - right).join(",");
        const rawKey = `${scenario}|${density}|${sortedIds}`;
        const cacheKey = `weaver:cache:${crypto.createHash("md5").update(rawKey).digest("hex")}`;

        const cachedDataStr = await redis.get(cacheKey);
        if (cachedDataStr) {
            try {
                const cachedData = JSON.parse(cachedDataStr) as { content: string; articleId: string };
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", data: cachedData.content })}\n\n`));
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                        controller.close();
                    },
                });

                return new Response(stream, {
                    headers: {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Weaver-Id": cachedData.articleId,
                        "X-Weaver-Cache": "HIT",
                    },
                });
            } catch (error) {
                log.error({ error }, "Failed to parse mobile weaver cache");
            }
        }

        const articleId = crypto.randomUUID();
        let candidates: Array<{ id: number; word: string; definition_cn: string; pos?: string }>;
        let isFreeReadingMode = false;

        if (targetWordIds.length > 0) {
            const manualRaw = await prisma.vocab.findMany({
                where: { id: { in: targetWordIds } },
                select: { id: true, word: true, definition_cn: true, partOfSpeech: true },
            });
            candidates = manualRaw.map((item) => ({
                id: item.id,
                word: item.word,
                definition_cn: item.definition_cn || "",
                pos: item.partOfSpeech || undefined,
            }));
        } else {
            const result = await getWeaverIngredients(userId, scenario, false, userId);
            if (result.status === "success" && result.data) {
                candidates = [
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
            } else {
                candidates = [];
            }
        }

        if (candidates.length === 0) {
            isFreeReadingMode = true;
        }

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

        return handleOpenAIStream(messages, {
            model: process.env.QWEN_MODEL_NAME || "qwen-plus",
            temperature: 0.7,
            errorContext: "Mobile Weaver Generation",
            headers: {
                "X-Weaver-Id": articleId,
                "X-Weaver-Cache": "MISS",
            },
            onComplete: async (text) => {
                const titleMatch = text.match(/===TITLE===\s*([\s\S]*?)\s*===BODY===/);
                let title = titleMatch ? titleMatch[1].trim() : `${scenario} - ${new Date().toISOString().split("T")[0]}`;
                title = title.replace(/\*\*/g, "").replace(/#+/g, "").trim();

                try {
                    await prisma.article.create({
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
                        await prisma.articleVocab.createMany({
                            data: candidates.map((candidate) => ({
                                articleId,
                                vocabId: candidate.id,
                                role: "TARGET",
                            })),
                        });
                    }
                } catch (error) {
                    log.error({ error }, "Failed to save mobile article");
                }

                try {
                    await redis.set(
                        cacheKey,
                        JSON.stringify({ content: text, articleId }),
                        "EX",
                        3600
                    );
                } catch (error) {
                    log.error({ error }, "Failed to write mobile weaver cache");
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
        });
    } catch (error) {
        log.error({ error }, "Mobile weaver generation failed");
        return Response.json(
            createMobileErrorEnvelope(
                "INTERNAL_ERROR",
                error instanceof Error ? error.message : "Failed to generate briefing"
            ),
            { status: 500 }
        );
    }
}
