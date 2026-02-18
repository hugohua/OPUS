"use server";

/**
 * Weaver Selection Server Action (v2.1)
 * 
 * 功能：
 *   场景优先选词 - 4 层瀑布策略为 Weaver Lab 提供候选词汇
 * 
 * 策略瀑布：
 *   层 1: Due 词 + 场景匹配 (复习 + 语境一致)
 *   层 2: New 词 + 场景匹配 (正确语境首次曝光)
 *   层 3: Due 词 + 跨场景 (保证复习效果)
 *   层 4: Filler 词 + 场景匹配 (已掌握词支撑文章)
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

import { redis } from '@/lib/queue/connection';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { ActionState } from '@/types/action';
import { auditWeaverSelection } from '@/lib/services/audit-service';
import { getDbScenariosForWeaver, WEAVER_SCENARIOS } from '@/lib/constants/weaver-scenario-map';

// 选词目标数量
const TARGET_PRIORITY = 10;
const TARGET_FILLER = 4;
const CACHE_TTL = 600; // 10 分钟

// 参数校验
const WeaverSelectionSchema = z.object({
    userId: z.string().min(1),
    scenario: z.enum(WEAVER_SCENARIOS as [string, ...string[]])
});

/**
 * 获取 Weaver 生成所需的词汇食材 (v2.1 场景优先)
 * 
 * @param userId 用户 ID (将与 Session 校验一致性)
 * @param scenario Weaver 场景 (finance, hr, marketing, operations, office, tech)
 */
export async function getWeaverIngredients(
    userId: string,
    scenario: string,
    forceRefresh: boolean = false
): Promise<ActionState<{
    priorityWords: Array<{ id: number; word: string; meaning: string; source: string }>;
    fillerWords: Array<{ id: number; word: string; meaning: string }>;
}>> {
    try {
        // ✅ 鉴权校验 (防止 IDOR 越权)
        const session = await auth();
        if (!session?.user?.id || session.user.id !== userId) {
            return { status: 'error', message: 'Unauthorized: session mismatch' };
        }

        // ✅ 参数校验
        const validated = WeaverSelectionSchema.parse({ userId, scenario });
        const dbScenarios = getDbScenariosForWeaver(validated.scenario);

        // ✅ 检查 Redis 缓存 (30s TTL, forceRefresh 可绕过)
        // Key 包含时间戳窗口，确保同一窗口内多次请求结果一致（防抖），除非强制刷新
        const timeWindow = Math.floor(Date.now() / 30000);
        const CACHE_KEY = `weaver:ingredients:${validated.userId}:${validated.scenario}:${forceRefresh ? 'manual_' + Date.now() : timeWindow}`;

        if (!forceRefresh) {
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                return {
                    status: 'success',
                    message: 'Loaded from cache',
                    data: JSON.parse(cached)
                };
            }
        }

        // ============================================
        // 4 层瀑布选词 (Randomized Pool Strategy)
        // ============================================
        const collectedIds = new Set<number>();
        const priorityWords: Array<{ id: number; word: string; meaning: string; source: string }> = [];

        // ✅ Helper: Fisher-Yates Shuffle (True Randomness)
        // 修复 B-2: Math.random() - 0.5 不均匀分布问题
        const shuffle = <T>(array: T[]): T[] => {
            const a = [...array];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        // --- 层 1: Due 词 + 场景匹配 (Pool: 50) ---
        if (dbScenarios.length > 0) {
            const dueMatchedPool = await prisma.userProgress.findMany({
                where: {
                    userId: validated.userId,
                    status: { in: ['LEARNING', 'REVIEW'] },
                    next_review_at: { lte: new Date() },
                    track: 'CONTEXT',
                    vocab: { scenarios: { hasSome: dbScenarios } }
                },
                take: 50, // Fetch larger pool
                orderBy: { next_review_at: 'asc' },
                select: {
                    vocab: { select: { id: true, word: true, definition_cn: true } }
                }
            });

            // Randomize selection from the pool
            const selected = shuffle(dueMatchedPool).slice(0, TARGET_PRIORITY);

            for (const up of selected) {
                if (!collectedIds.has(up.vocab.id)) {
                    collectedIds.add(up.vocab.id);
                    priorityWords.push({
                        id: up.vocab.id,
                        word: up.vocab.word,
                        meaning: up.vocab.definition_cn || "",
                        source: "due_matched"
                    });
                }
            }
        }

        // --- 层 2: New 词 + 场景匹配 (Pool: 50) ---
        if (priorityWords.length < TARGET_PRIORITY && dbScenarios.length > 0) {
            const remaining = TARGET_PRIORITY - priorityWords.length;
            const newMatchedPool = await prisma.vocab.findMany({
                where: {
                    scenarios: { hasSome: dbScenarios },
                    progress: { none: { userId: validated.userId } },
                    id: { notIn: [...collectedIds] }
                },
                take: 50, // Larger pool
                orderBy: { frequency_score: 'desc' },
                select: { id: true, word: true, definition_cn: true }
            });

            const selected = shuffle(newMatchedPool).slice(0, remaining);

            for (const v of selected) {
                if (!collectedIds.has(v.id)) {
                    collectedIds.add(v.id);
                    priorityWords.push({
                        id: v.id,
                        word: v.word,
                        meaning: v.definition_cn || "",
                        source: "new_matched"
                    });
                }
            }
        }

        // --- 层 3: Due 词 + 跨场景 (兜底) (Pool: 50) ---
        if (priorityWords.length < TARGET_PRIORITY) {
            const remaining = TARGET_PRIORITY - priorityWords.length;
            const dueFallbackPool = await prisma.userProgress.findMany({
                where: {
                    userId: validated.userId,
                    status: { in: ['LEARNING', 'REVIEW'] },
                    next_review_at: { lte: new Date() },
                    track: 'CONTEXT',
                    vocabId: { notIn: [...collectedIds] }
                },
                take: 50,
                orderBy: { next_review_at: 'asc' },
                select: {
                    vocab: { select: { id: true, word: true, definition_cn: true } }
                }
            });

            const selected = shuffle(dueFallbackPool).slice(0, remaining);

            for (const up of selected) {
                if (!collectedIds.has(up.vocab.id)) {
                    collectedIds.add(up.vocab.id);
                    priorityWords.push({
                        id: up.vocab.id,
                        word: up.vocab.word,
                        meaning: up.vocab.definition_cn || "",
                        source: "due_fallback"
                    });
                }
            }
        }

        // --- 层 4: Filler 词 + 场景匹配 ---
        const fillerWhere: any = {
            userId: validated.userId,
            state: 2, // Review
            stability: { gte: 30 },
            vocabId: { notIn: [...collectedIds] }
        };

        // 场景匹配优先
        if (dbScenarios.length > 0) {
            fillerWhere.vocab = { scenarios: { hasSome: dbScenarios } };
        }

        const fillerRaw = await prisma.userProgress.findMany({
            where: fillerWhere,
            take: TARGET_FILLER,
            orderBy: { stability: 'desc' },
            select: {
                vocab: {
                    select: { id: true, word: true, definition_cn: true }
                }
            }
        });

        const fillerWords = fillerRaw.map(uv => ({
            id: uv.vocab.id,
            word: uv.vocab.word,
            meaning: uv.vocab.definition_cn || ""
        }));

        const resultData = { priorityWords, fillerWords };

        // ✅ 写入缓存 (30s TTL)
        // 即使是 forceRefresh 产生的结果也缓存 30s，防止瞬间重复点击
        const WRITE_TTL = 30;
        await redis.setex(CACHE_KEY, WRITE_TTL, JSON.stringify(resultData));

        // ✅ 审计记录
        auditWeaverSelection(validated.userId, validated.scenario, {
            priorityCount: priorityWords.length,
            fillerCount: fillerWords.length,
            priorityIds: priorityWords.map(w => w.id),
            fillerIds: fillerWords.map(w => w.id)
        });

        return {
            status: 'success',
            message: `Loaded ${priorityWords.length} priority + ${fillerWords.length} filler`,
            data: resultData
        };

    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                status: 'error',
                message: 'Invalid parameters',
                fieldErrors: error.flatten().fieldErrors as Record<string, string>
            };
        }

        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
