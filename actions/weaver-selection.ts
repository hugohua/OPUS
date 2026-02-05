"use server";

/**
 * Weaver Selection Server Action
 * 
 * 功能：
 *   智能装填 - 为 Weaver Lab 提供候选词汇列表
 * 
 * 使用方法：
 *   import { getWeaverIngredients } from '@/actions/weaver-selection';
 *   const { priorityWords, fillerWords } = await getWeaverIngredients(userId, scenario);
 * 
 * 作者: Hugo
 * 日期: 2026-02-05
 */

import { redis } from '@/lib/queue/connection';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fetchOMPSCandidates } from '@/lib/services/omps-core';
import { ActionState } from '@/types/action';
import { auditWeaverSelection } from '@/lib/services/audit-service';

// ... (existing imports)

/**
 * 获取 Weaver 生成所需的词汇食材
 * 
 * 策略：
 * - Priority Words: FSRS Due/New 词汇 (8-12个, 70% 权重)
 * - Filler Words: 已熟记词汇 (3-5个, 30% 权重)
 * - [Performance]: Redis Cache (TTL 10m)
 * 
 * @param userId 用户 ID
 * @param scenario 场景 (finance, hr, marketing, rnd)
 */
export async function getWeaverIngredients(
    userId: string,
    scenario: string
): Promise<ActionState<{
    priorityWords: Array<{ id: number; word: string; meaning: string }>;
    fillerWords: Array<{ id: number; word: string; meaning: string }>;
}>> {
    try {
        // ✅ 参数校验
        const validated = z.object({
            userId: z.string().min(1),
            scenario: z.enum(["finance", "hr", "marketing", "rnd"])
        }).parse({ userId, scenario });

        // ✅ [Cache Spec] 检查 Redis 缓存
        const CACHE_KEY = `weaver:ingredients:${validated.userId}:${validated.scenario}`;
        const cached = await redis.get(CACHE_KEY);

        if (cached) {
            console.log(`[WeaverSelection] Cache Hit for ${CACHE_KEY}`);
            return {
                status: 'success',
                message: 'Loaded from cache',
                data: JSON.parse(cached)
            };
        }

        // ✅ [WL-01] 智能装填：从 FSRS 获取 Priority Words
        const priorityRaw = await fetchOMPSCandidates(
            validated.userId,
            10, // 8-12 个
            { reviewRatio: 0.8 }, // 优先 Due 词
            [], // no excludes
            "CONTEXT" // L2 Track
        );

        const priorityWords = priorityRaw.map(c => ({
            id: c.vocabId,
            word: c.word,
            meaning: c.definition_cn
        }));

        // ✅ 获取 Filler Words：已熟记且稳定性高的词汇
        const fillerRaw = await prisma.userProgress.findMany({
            where: {
                userId: validated.userId,
                state: 2, // 2 = Review
                stability: { gte: 30 } // 高稳定性
            },
            take: 4,
            orderBy: { stability: 'desc' },
            select: {
                vocab: {
                    select: {
                        id: true,
                        word: true,
                        definition_cn: true
                    }
                }
            }
        });

        const fillerWords = fillerRaw.map(uv => ({
            id: uv.vocab.id,
            word: uv.vocab.word,
            meaning: uv.vocab.definition_cn || ""
        }));

        const resultData = {
            priorityWords,
            fillerWords
        };

        // ✅ [Cache Spec] 写入缓存 (TTL 10m)
        await redis.setex(CACHE_KEY, 600, JSON.stringify(resultData));

        // ✅ [Audit] 记录选词结果 (Phase 4)
        auditWeaverSelection(validated.userId, validated.scenario, {
            priorityCount: priorityWords.length,
            fillerCount: fillerWords.length,
            priorityIds: priorityWords.map(w => w.id),
            fillerIds: fillerWords.map(w => w.id)
        });

        return {
            status: 'success',
            message: `Loaded ${priorityWords.length} priority words + ${fillerWords.length} filler words`,
            data: resultData
        };

    } catch (error) {
        console.error('[WeaverSelection] Error:', error);

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
