'use server';

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { QuestionType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { updateBkt } from "@/lib/algorithm/bkt";

const log = logger.child({ module: 'arena-telemetry' });

const attemptSchema = z.object({
    questionSeedId: z.string().optional(),
    anchorVocabId: z.number().nullable(),
    isCorrect: z.boolean(),
    responseTimeMs: z.number(),
    selectedOption: z.string(),
    questionType: z.nativeEnum(QuestionType),
    part: z.number().int(),
    // [V9.0] 错题本：仅答错时前端传入完整 BriefingPayload 快照
    snapshotPayload: z.any().optional(),
});

export type AttemptRecordPayload = z.infer<typeof attemptSchema>;

/**
 * 记录 The Arena 的单次答题结果。
 * [V9.0] 新增错题本双写逻辑：答错且携带 snapshotPayload 时，
 *        在同一 $transaction 中写入 UserMistakeBook。
 */
export async function recordArenaOutcome(payload: AttemptRecordPayload) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const data = attemptSchema.parse(payload);
    const userId = session.user.id;

    // 0. 查询 QuestionSeed 获取 grammarNodeId + difficulty + targetAnswer
    let seed = null;
    if (data.questionSeedId) {
        seed = await prisma.questionSeed.findUnique({
            where: { id: data.questionSeedId },
            select: { grammarNodeId: true, difficulty: true, targetAnswer: true },
        });
    }

    // 1. [V9.0] $transaction 双写：AttemptRecord + UserMistakeBook
    const attempt = await prisma.$transaction(async (tx) => {
        // 1.1 插入 AttemptRecord（原逻辑不变）
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

        // 1.2 [V9.0] 仅答错且携带快照时写入错题本
        if (!data.isCorrect && data.snapshotPayload) {
            const snapshotMeta = data.snapshotPayload?.meta || {};

            // 提取快照中特定题目的 correctAnswer
            let extractedCorrectAnswer = '';
            const interactions = data.snapshotPayload.segments?.filter((s: any) => s.type === 'interaction') || [];
            if (interactions.length > 0) {
                // 对于 Part 6，前端写入了 target_word_blank_index (1-based) 代表当前题号
                const qIdx = snapshotMeta.target_word_blank_index;
                const interaction = (qIdx && typeof qIdx === 'number' && qIdx <= interactions.length)
                    ? interactions[qIdx - 1]
                    : interactions[0];

                if (interaction?.task?.answer_key) {
                    extractedCorrectAnswer = interaction.task.answer_key;
                } else if (Array.isArray(interaction?.task?.options)) {
                    const corr = interaction.task.options.find((o: any) => o.is_correct || o.isCorrect);
                    if (corr && corr.text) extractedCorrectAnswer = corr.text;
                }
            }

            const finalCorrectAnswer = extractedCorrectAnswer || seed?.targetAnswer || '';

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
                    status: 'ACTIVE',
                },
            });
            log.info({ userId, part: data.part, selectedOption: data.selectedOption, finalCorrectAnswer },
                '[MistakeBook] 错题快照已写入');
        }

        return record;
    });

    // 2. 词汇轨：只有答错了才去尝试分析是否需要"降维打击"
    if (!data.isCorrect && data.anchorVocabId) {
        checkAndTriggerIntervention(userId, data.anchorVocabId, attempt.id).catch((err) => {
            log.error({ err }, '[Telemetry] intervention failed');
        });
    }

    // 3. [V3.0] 语法轨：异步 BKT 更新（fire-and-forget）
    if (seed?.grammarNodeId) {
        updateGrammarMastery(
            userId, seed.grammarNodeId, data.isCorrect, seed.difficulty ?? 2
        ).catch((err) => {
            log.error({ err }, '[BKT] Grammar mastery update failed');
        });
    }

    return { success: true, attemptId: attempt.id };
}

// ---------------------------------------------------------------------------
// [V3.0] BKT 语法轨追踪引擎
// ---------------------------------------------------------------------------

/** 穿透去抖：防止快速连续答题触发重复穿透 */
const propagationDebounce = new Map<string, number>();
const DEBOUNCE_MS = 2000;

/**
 * 更新用户对某个 L3 语法节点的 BKT 掌握度。
 * 🟡 审计修复 #2：整个流程包裹在 $transaction 中防竞态。
 */
async function updateGrammarMastery(
    userId: string,
    grammarNodeId: string,
    isCorrect: boolean,
    difficulty: number = 2
) {
    await prisma.$transaction(async (tx) => {
        // 1. Upsert 获取当前状态（事务内读取，防竞态）
        const current = await tx.userGrammarProficiency.upsert({
            where: { userId_grammarNodeId: { userId, grammarNodeId } },
            create: { userId, grammarNodeId, masteryScore: 0.5 },
            update: {},
        });

        // 2. BKT 纯函数计算
        const result = updateBkt(
            {
                masteryScore: current.masteryScore,
                exposureCount: current.exposureCount,
                correctCount: current.correctCount,
            },
            isCorrect,
            difficulty
        );

        // 3. 写回 DB
        const oldScore = current.masteryScore;
        await tx.userGrammarProficiency.update({
            where: { id: current.id },
            data: {
                masteryScore: result.newMasteryScore,
                exposureCount: result.newExposureCount,
                correctCount: result.newCorrectCount,
            },
        });

        log.info({
            userId, grammarNodeId, isCorrect,
            old: oldScore, new: result.newMasteryScore,
        }, '[BKT] Mastery updated');

        // 4. 穿透判定（阈值 ±0.05）
        const delta = Math.abs(result.newMasteryScore - oldScore);
        if (delta >= 0.05) {
            propagateToParent(userId, grammarNodeId).catch((err) => {
                log.error({ err }, '[BKT] Propagation failed');
            });
        }
    });
}

/**
 * 向上穿透传递：重算 L2/L1 父节点的加权平均 masteryScore。
 * 🟡 审计修复 #3：带 2 秒去抖，防止快速答题触发重复穿透。
 */
async function propagateToParent(userId: string, childNodeId: string, depth = 0) {
    if (depth >= 3) return; // 防御性上限：L3→L2→L1 最多 2 层穿透

    // 查询当前节点的父节点
    const node = await prisma.grammarNode.findUnique({
        where: { id: childNodeId },
        select: { parentId: true },
    });
    if (!node?.parentId) return; // 已到根节点

    // 去抖检查
    const key = `${userId}:${node.parentId}`;
    const lastTime = propagationDebounce.get(key) || 0;
    if (Date.now() - lastTime < DEBOUNCE_MS) return;
    propagationDebounce.set(key, Date.now());

    // 查询所有同级子节点的掌握度
    const siblings = await prisma.userGrammarProficiency.findMany({
        where: {
            userId,
            grammarNode: { parentId: node.parentId },
        },
        select: { masteryScore: true },
    });

    if (siblings.length === 0) return;
    const avg = Math.round(
        (siblings.reduce((s, p) => s + p.masteryScore, 0) / siblings.length) * 10000
    ) / 10000;

    // Upsert 父节点
    await prisma.userGrammarProficiency.upsert({
        where: { userId_grammarNodeId: { userId, grammarNodeId: node.parentId } },
        create: { userId, grammarNodeId: node.parentId, masteryScore: avg },
        update: { masteryScore: avg },
    });

    log.info({ userId, parentId: node.parentId, avg }, '[BKT] Propagated to parent');

    // 递归向上（L2 → L1）
    await propagateToParent(userId, node.parentId, depth + 1);
}

// ---------------------------------------------------------------------------
// 词汇轨：降维打击策略 (已有逻辑，未修改)
// ---------------------------------------------------------------------------

/**
 * 【降维打击策略】
 * 后置校验：如果用户在 The Arena 中对同一个锚点词应用连续做错，说明在 The Dojo 积攒的记忆强度是虚高的。
 * 此时强制将其打回 Learning 状态重新学习。
 */
async function checkAndTriggerIntervention(userId: string, vocabId: number, triggerAttemptId: string) {
    const recentAttempts = await prisma.attemptRecord.findMany({
        where: { userId, anchorVocabId: vocabId },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    if (recentAttempts.length < 3) return;

    const mistakes = recentAttempts.filter((a: { isCorrect: boolean }) => !a.isCorrect).length;

    if (mistakes >= 3) {
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

            if (!progress) return;
            if (progress.state === 1) return;

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
                    userId: userId,
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

        log.info({ userId, vocabId }, '[Diagnostic Engine] Forced step-down');
    }
}

