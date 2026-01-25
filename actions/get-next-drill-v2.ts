'use server';

/**
 * [V2.0] 五维记忆系统 - 混合器 API
 * 
 * 功能：
 *   1. 从注入队列取错题
 *   2. 从 FSRS 到期词取题
 *   3. 根据最弱维度选择题型
 *   4. 从 Redis 分频道库存取题
 *   5. 降级：确定性生成
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import {
    BriefingPayload,
    DrillType,
    DimensionCode,
    DRILL_TYPE_TO_DIMENSION,
    DIMENSION_TO_DB_FIELD
} from '@/types/briefing';
import { inventory } from '@/lib/inventory';
import { buildSimpleDrill } from '@/lib/templates/deterministic-drill';
import { redis } from '@/lib/queue/connection';

const log = createLogger('actions:get-next-drill-v2');

// ============================================
// Redis Key Schema
// ============================================
const redisKeys = {
    injection: (userId: string) => `injection:${userId}`,
};

// ============================================
// Types
// ============================================
interface DrillResult {
    drill: BriefingPayload;
    source: 'injection' | 'inventory' | 'deterministic';
}

// ============================================
// Main API: fetchNextDrillV2
// ============================================
export async function fetchNextDrillV2(
    userId: string
): Promise<ActionState<DrillResult>> {
    try {
        log.info({ userId }, '[V2] Fetching next drill');

        // ============================================
        // Step 1: 检查注入队列 (错题复现)
        // ============================================
        log.info({ userId }, '[V2][Step1] 检查注入队列...');
        const injected = await checkInjectionQueue(userId);
        if (injected) {
            log.info({ userId, vocabId: injected.meta?.vocabId, drillType: injected.meta?.drillType }, '[V2][Step1] ✅ 命中注入队列');
            return {
                status: 'success',
                message: 'Drill from injection queue',
                data: { drill: injected, source: 'injection' }
            };
        }

        // ============================================
        // Step 2: 获取 FSRS 到期词
        // ============================================
        const dueProgress = await db.userProgress.findFirst({
            where: {
                userId,
                next_review_at: { lte: new Date() }
            },
            orderBy: { next_review_at: 'asc' },
            include: { vocab: true }
        });

        if (!dueProgress) {
            log.info({ userId }, '[V2][Step2] 无到期词，获取新词...');
            // 没有到期词，获取新词
            const newVocab = await db.vocab.findFirst({
                where: {
                    progress: { none: { userId } },
                    OR: [{ is_toeic_core: true }, { abceed_level: { lte: 2 } }]
                },
                orderBy: { frequency_score: 'desc' }
            });

            if (!newVocab) {
                log.warn({ userId }, '[V2][Step2] ⚠️ 无可用词汇');
                return {
                    status: 'success',
                    message: 'No drills available',
                    data: null as any
                };
            }

            log.info({ userId, vocabId: newVocab.id, word: newVocab.word }, '[V2][Step2] ✅ 新词 S_V_O 降级生成');
            // 新词默认使用 S_V_O (最简单)
            const drill = buildSimpleDrillV2(newVocab, 'S_V_O');
            return {
                status: 'success',
                message: 'New vocabulary drill',
                data: { drill, source: 'deterministic' }
            };
        }

        log.info({ userId, vocabId: dueProgress.vocabId, word: dueProgress.vocab?.word }, '[V2][Step2] ✅ 获取到期词');

        // ============================================
        // Step 3: 根据最弱维度选择题型
        // ============================================
        const weakestType = selectDrillTypeByWeakness(dueProgress);
        log.info({ userId, vocabId: dueProgress.vocabId, weakestType }, '[V2] Selected drill type');

        // ============================================
        // Step 4: 从 Redis 库存取题
        // ============================================
        log.info({ userId, vocabId: dueProgress.vocabId, drillType: weakestType }, '[V2][Step4] 尝试从 Redis 库存取题...');
        const drill = await inventory.popDrillV2(userId, dueProgress.vocabId, weakestType);

        if (drill) {
            log.info({ userId, vocabId: dueProgress.vocabId, drillType: weakestType }, '[V2][Step4] ✅ 库存命中');
            return {
                status: 'success',
                message: `Drill from inventory (${weakestType})`,
                data: { drill, source: 'inventory' }
            };
        }

        // ============================================
        // Step 5: 降级 - 确定性生成
        // ============================================
        log.info({ userId, vocabId: dueProgress.vocabId, drillType: weakestType }, '[V2][Step5] 库存未命中，降级生成');
        const fallbackDrill = buildSimpleDrillV2(dueProgress.vocab, weakestType);

        // 触发后台补货
        triggerReplenishment(userId, dueProgress.vocabId, weakestType);
        log.info({ userId, vocabId: dueProgress.vocabId }, '[V2][Step5] ✅ 降级生成完成，已触发后台补货');

        return {
            status: 'success',
            message: 'Drill from deterministic fallback',
            data: { drill: fallbackDrill, source: 'deterministic' }
        };

    } catch (error: any) {
        log.error({ error, userId }, '[V2] fetchNextDrillV2 failed');
        return {
            status: 'error',
            message: error.message || 'Failed to fetch drill'
        };
    }
}

// ============================================
// Helper: 检查注入队列
// ============================================
async function checkInjectionQueue(userId: string): Promise<BriefingPayload | null> {
    const key = redisKeys.injection(userId);
    const now = Date.now();

    // ZPOPMIN: 取出 score 最小的项 (最早注入的)
    const result = await redis.zrangebyscore(key, 0, now, 'LIMIT', 0, 1);

    if (result.length === 0) return null;

    // 移除已取出的项
    await redis.zrem(key, result[0]);

    try {
        return JSON.parse(result[0]);
    } catch {
        return null;
    }
}

// ============================================
// Helper: 根据最弱维度选择题型
// ============================================
function selectDrillTypeByWeakness(progress: any): DrillType {
    // 本期只支持 3 种题型
    const scores: Array<{ type: DrillType; score: number }> = [
        { type: 'S_V_O', score: progress.dim_mea_score ?? 0 },
        { type: 'VISUAL_TRAP', score: progress.dim_vis_score ?? 0 },
        { type: 'PART5_CLOZE', score: progress.dim_ctx_score ?? 0 },
    ];

    // 检查是否有 confusing_words (VISUAL_TRAP 需要)
    const vocab = progress.vocab;
    const hasConfusingWords = vocab?.confusing_words?.length > 0;

    // 过滤掉没有 confusing_words 的 VISUAL_TRAP
    const available = scores.filter(s => {
        if (s.type === 'VISUAL_TRAP' && !hasConfusingWords) return false;
        return true;
    });

    if (available.length === 0) {
        return 'S_V_O'; // 兜底
    }

    // 取最弱的
    available.sort((a, b) => a.score - b.score);

    // 维度互斥：避免连续两次考同维度
    const lastDim = progress.last_dim_tested;
    if (available[0].type === `${DRILL_TYPE_TO_DIMENSION[available[0].type]}` && available.length > 1) {
        // 如果最弱的就是上次考的，换下一个
        const dimension = DRILL_TYPE_TO_DIMENSION[available[0].type];
        if (lastDim === dimension && available.length > 1) {
            return available[1].type;
        }
    }

    return available[0].type;
}

// ============================================
// Helper: 构建 V2 Drill
// ============================================
function buildSimpleDrillV2(vocab: any, drillType: DrillType): BriefingPayload {
    const dimension = DRILL_TYPE_TO_DIMENSION[drillType];

    // S_V_O: 中选英
    if (drillType === 'S_V_O') {
        return {
            meta: {
                format: 'chat',
                mode: 'SYNTAX',
                batch_size: 1,
                sys_prompt_version: 'v2-deterministic',
                vocabId: vocab.id,
                target_word: vocab.word,
                source: 'deterministic',
                drillType: 'S_V_O',
                dimension: 'MEA'
            },
            segments: [
                {
                    type: 'text',
                    content_markdown: `**${vocab.definition_cn || '暂无释义'}**`
                },
                {
                    type: 'interaction',
                    dimension: 'MEA',
                    task: {
                        style: 'swipe_card',
                        question_markdown: `"${vocab.definition_cn}" 对应的英文是？`,
                        options: [vocab.word, '我不认识'],
                        answer_key: vocab.word,
                        explanation_markdown: `**${vocab.word}**\n\n${vocab.definition_cn || '暂无释义'}`
                    }
                }
            ]
        };
    }

    // VISUAL_TRAP: 形似词找茬
    if (drillType === 'VISUAL_TRAP') {
        const distractors = (vocab.confusing_words || []).slice(0, 3);
        const options = [vocab.word, ...distractors].sort(() => Math.random() - 0.5);

        return {
            meta: {
                format: 'chat',
                mode: 'SYNTAX',
                batch_size: 1,
                sys_prompt_version: 'v2-deterministic',
                vocabId: vocab.id,
                target_word: vocab.word,
                source: 'deterministic',
                drillType: 'VISUAL_TRAP',
                dimension: 'VIS'
            },
            segments: [
                {
                    type: 'text',
                    content_markdown: `**${vocab.definition_cn || '暂无释义'}**`
                },
                {
                    type: 'interaction',
                    dimension: 'VIS',
                    task: {
                        style: 'swipe_card',
                        question_markdown: `哪个是正确拼写？`,
                        options,
                        answer_key: vocab.word,
                        explanation_markdown: `正确答案: **${vocab.word}**`
                    }
                }
            ]
        };
    }

    // PART5_CLOZE: 使用现有简单模板
    return buildSimpleDrill(vocab, 'SYNTAX');
}

// ============================================
// Helper: 触发后台补货
// ============================================
function triggerReplenishment(userId: string, vocabId: number, drillType: DrillType) {
    // 异步触发，不阻塞
    inventory.triggerEmergency(userId, 'SYNTAX', vocabId).catch(err => {
        log.warn({ error: err.message, userId, vocabId, drillType }, 'Replenishment trigger failed');
    });
}
