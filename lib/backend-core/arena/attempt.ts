import { QuestionType } from "@prisma/client";
import { z } from "zod";

import { updateBkt } from "@/lib/algorithm/bkt";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "arena-attempt-core" });

export const attemptSchema = z.object({
    questionSeedId: z.string().optional(),
    anchorVocabId: z.number().nullable(),
    isCorrect: z.boolean(),
    responseTimeMs: z.number(),
    selectedOption: z.string(),
    questionType: z.nativeEnum(QuestionType),
    part: z.number().int(),
    snapshotPayload: z.any().optional(),
});

export type AttemptRecordPayload = z.infer<typeof attemptSchema>;

export async function recordArenaAttemptForUser(userId: string, payload: AttemptRecordPayload) {
    const data = attemptSchema.parse(payload);

    let seed: { grammarNodeId: string | null; difficulty: number | null; targetAnswer: string | null } | null = null;
    if (data.questionSeedId) {
        seed = await prisma.questionSeed.findUnique({
            where: { id: data.questionSeedId },
            select: { grammarNodeId: true, difficulty: true, targetAnswer: true },
        });
    }

    const attempt = await prisma.$transaction(async (tx) => {
        const record = await tx.attemptRecord.create({
            data: {
                userId,
                questionSeedId: seed ? data.questionSeedId : undefined,
                anchorVocabId: data.anchorVocabId,
                isCorrect: data.isCorrect,
                responseTimeMs: data.responseTimeMs,
                selectedOption: data.selectedOption,
                questionType: data.questionType,
                part: data.part,
                grammarNodeId: seed?.grammarNodeId ?? null,
            },
        });

        if (!data.isCorrect && data.snapshotPayload) {
            const snapshotMeta = data.snapshotPayload?.meta || {};
            const finalCorrectAnswer = extractCorrectAnswerFromSnapshot(data.snapshotPayload, snapshotMeta)
                || seed?.targetAnswer
                || "";

            await tx.userMistakeBook.create({
                data: {
                    userId,
                    attemptRecordId: record.id,
                    mode: snapshotMeta.mode || `ARENA_PART${data.part}`,
                    part: data.part,
                    vocabId: data.anchorVocabId,
                    grammarNodeId: seed?.grammarNodeId ?? null,
                    questionType: data.questionType,
                    snapshot: data.snapshotPayload,
                    userWrongAnswer: data.selectedOption,
                    correctAnswer: finalCorrectAnswer,
                    status: "ACTIVE",
                },
            });
            log.info({ userId, part: data.part }, "Arena mistake snapshot recorded");
        }

        return record;
    });

    if (!data.isCorrect && data.anchorVocabId) {
        checkAndTriggerIntervention(userId, data.anchorVocabId, attempt.id).catch((err) => {
            log.error({ err }, "Arena intervention failed");
        });
    }

    if (seed?.grammarNodeId) {
        updateGrammarMastery(userId, seed.grammarNodeId, data.isCorrect, seed.difficulty ?? 2).catch((err) => {
            log.error({ err }, "Grammar mastery update failed");
        });
    }

    return { success: true, attemptId: attempt.id };
}

function extractCorrectAnswerFromSnapshot(snapshotPayload: any, snapshotMeta: any): string {
    const interactions = snapshotPayload?.segments?.filter((segment: any) => segment.type === "interaction") || [];
    if (interactions.length === 0) return "";

    const questionIndex = snapshotMeta.target_word_blank_index;
    const interaction = questionIndex && typeof questionIndex === "number" && questionIndex <= interactions.length
        ? interactions[questionIndex - 1]
        : interactions[0];

    if (interaction?.task?.answer_key) {
        return interaction.task.answer_key;
    }

    if (Array.isArray(interaction?.task?.options)) {
        const correct = interaction.task.options.find((option: any) => option.is_correct || option.isCorrect);
        if (correct?.text) return correct.text;
    }

    return "";
}

const propagationDebounce = new Map<string, number>();
const DEBOUNCE_MS = 2000;

async function updateGrammarMastery(
    userId: string,
    grammarNodeId: string,
    isCorrect: boolean,
    difficulty = 2
) {
    await prisma.$transaction(async (tx) => {
        const current = await tx.userGrammarProficiency.upsert({
            where: { userId_grammarNodeId: { userId, grammarNodeId } },
            create: { userId, grammarNodeId, masteryScore: 0.5 },
            update: {},
        });

        const result = updateBkt(
            {
                masteryScore: current.masteryScore,
                exposureCount: current.exposureCount,
                correctCount: current.correctCount,
            },
            isCorrect,
            difficulty
        );

        const oldScore = current.masteryScore;
        await tx.userGrammarProficiency.update({
            where: { id: current.id },
            data: {
                masteryScore: result.newMasteryScore,
                exposureCount: result.newExposureCount,
                correctCount: result.newCorrectCount,
            },
        });

        const delta = Math.abs(result.newMasteryScore - oldScore);
        if (delta >= 0.05) {
            propagateToParent(userId, grammarNodeId).catch((err) => {
                log.error({ err }, "Grammar mastery propagation failed");
            });
        }
    });
}

async function propagateToParent(userId: string, childNodeId: string, depth = 0) {
    if (depth >= 3) return;

    const node = await prisma.grammarNode.findUnique({
        where: { id: childNodeId },
        select: { parentId: true },
    });
    if (!node?.parentId) return;

    const key = `${userId}:${node.parentId}`;
    const lastTime = propagationDebounce.get(key) || 0;
    if (Date.now() - lastTime < DEBOUNCE_MS) return;
    propagationDebounce.set(key, Date.now());

    const siblings = await prisma.userGrammarProficiency.findMany({
        where: {
            userId,
            grammarNode: { parentId: node.parentId },
        },
        select: { masteryScore: true },
    });

    if (siblings.length === 0) return;
    const avg = Math.round(
        (siblings.reduce((sum, proficiency) => sum + proficiency.masteryScore, 0) / siblings.length) * 10000
    ) / 10000;

    await prisma.userGrammarProficiency.upsert({
        where: { userId_grammarNodeId: { userId, grammarNodeId: node.parentId } },
        create: { userId, grammarNodeId: node.parentId, masteryScore: avg },
        update: { masteryScore: avg },
    });

    await propagateToParent(userId, node.parentId, depth + 1);
}

async function checkAndTriggerIntervention(userId: string, vocabId: number, triggerAttemptId: string) {
    const recentAttempts = await prisma.attemptRecord.findMany({
        where: { userId, anchorVocabId: vocabId },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    if (recentAttempts.length < 3) return;

    const mistakes = recentAttempts.filter((attempt: { isCorrect: boolean }) => !attempt.isCorrect).length;
    if (mistakes < 3) return;

    await prisma.$transaction(async (tx) => {
        const progress = await tx.userProgress.findUnique({
            where: {
                userId_vocabId_track: {
                    userId,
                    vocabId,
                    track: "VISUAL",
                },
            },
        });

        if (!progress || progress.state === 1) return;

        await tx.userProgress.update({
            where: { id: progress.id },
            data: {
                state: 1,
                stability: 0,
                dueDate: new Date(),
                next_review_at: new Date(),
                lapses: progress.lapses + 1,
            },
        });

        const vocab = await tx.vocab.findUnique({
            where: { id: vocabId },
            select: { word: true },
        });

        await tx.drillAudit.create({
            data: {
                targetWord: vocab?.word || `vocab_${vocabId}`,
                contextMode: "FSRS:INTERVENTION",
                status: "AUDIT",
                userId,
                auditTags: ["step_down", "arena_failure"],
                payload: {
                    reason: "User failed recent 3 out of 5 application attempts in Arena.",
                    triggerAttemptId,
                    oldState: progress.state,
                    oldStability: progress.stability,
                    oldDueDate: progress.dueDate,
                },
            },
        });
    });

    log.info({ userId, vocabId }, "Arena diagnostic intervention forced step-down");
}
