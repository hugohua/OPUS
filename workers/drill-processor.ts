/**
 * Drill 生成处理器 (V2.0 Schedule-Driven)
 */
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { DrillJobData } from '@/lib/queue/inventory-queue';
import { generateWithFailover } from './llm-failover';
import { getDrillBatchPrompt } from '@/lib/prompts/drill';
import { inventory } from '@/lib/inventory';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { SessionMode, BriefingPayload } from '@/types/briefing';
import { safeParse } from '@/lib/ai/utils';

const log = logger.child({ module: 'drill-processor' });

// AI 输出 Schema (Reusable)
const SingleDrillSchema = z.object({
    meta: z.object({
        format: z.enum(['chat', 'email', 'memo']),
        // mode: z.enum(['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ']), // Optional in LLM response, inferred from context
        target_word: z.string().optional(),
    }),
    segments: z.array(z.any()),
});

const BatchDrillOutputSchema = z.object({
    drills: z.array(SingleDrillSchema),
});

/**
 * 处理 Drill 生成 Job
 */
export async function processDrillJob(job: Job<DrillJobData>) {
    const { userId, mode, correlationId, vocabId, vocabIds } = job.data;

    log.info({ correlationId, userId, mode, jobType: job.name, vocabId, vocabCount: vocabIds?.length }, '开始处理 Drill 生成任务');

    try {
        // ============================================
        // 1. 确定生成目标 (Candidates)
        // ============================================
        let candidates: DrillCandidate[] = [];

        if (vocabIds && vocabIds.length > 0) {
            // Plan C: Batch Replenishment
            candidates = await fetchSpecificCandidates(userId, vocabIds);
        } else if (vocabId) {
            // Plan B: Single Emergency Replenishment
            candidates = await fetchSpecificCandidates(userId, [Number(vocabId)]);
        } else {
            // [Fix] V2 Generic Fetch (Schedule-Driven)
            // If job type is 'generate-*', we should fetch the next due items from DB.
            if (job.name.startsWith('generate-')) {
                const limit = job.data.forceLimit || 10;
                candidates = await fetchDueCandidates(userId, mode, limit);
            } else {
                log.warn({ jobName: job.name }, 'Unknown job type or missing IDs');
                return { success: false, reason: 'legacy_not_supported_v2' };
            }
        }

        if (candidates.length === 0) {
            log.warn({ correlationId }, '没有可用的词汇候选');
            return { success: false, reason: 'no_candidates' };
        }

        // ============================================
        // 2. 准备 Prompt 输入 & 调用 LLM
        // ============================================
        const promptInputs = await Promise.all(
            candidates.map(async (c) => {
                const contextWords = await getContextWords(c.word);
                return {
                    targetWord: c.word,
                    meaning: c.definition_cn || '暂无释义',
                    contextWords,
                    wordFamily: (c.word_family as Record<string, string>) || { v: c.word },
                };
            })
        );

        const { system, user } = getDrillBatchPrompt(promptInputs);
        const { text, provider } = await generateWithFailover(system, user);

        log.info({ correlationId, provider }, 'LLM 生成完成');

        // ============================================
        // 3. 解析 & 验证
        // ============================================
        // ============================================
        // 3. 解析 & 验证
        // ============================================
        let resultData;
        try {
            // [Safe Parse] 使用 lib/ai/utils 提供的安全解析
            resultData = safeParse(text, BatchDrillOutputSchema, {
                model: provider,
                systemPrompt: system,
                userPrompt: user
            });
        } catch (e) {
            // safeParse 内部已记录 logAIError，这里只需rethrow中断流程
            throw new Error('AI response parsing failed');
        }

        // ============================================
        // 4. 保存到 V2 Inventory (Redis)
        // ============================================
        const generatedDrills = resultData.drills;
        let successCount = 0;

        for (let i = 0; i < generatedDrills.length; i++) {
            const rawDrill = generatedDrills[i];
            const candidate = candidates[i];

            // Safety check: alignment
            if (!candidate) continue;

            const payload: BriefingPayload = {
                meta: {
                    format: rawDrill.meta.format as any,
                    mode: mode,
                    batch_size: 1, // Stored individually
                    sys_prompt_version: 'v2.8-schedule',
                    vocabId: candidate.vocabId,
                    target_word: candidate.word,
                    source: 'llm_v2',
                    drillType: 'S_V_O' // [V2] 当前 Prompt 仅支持 S_V_O
                },
                segments: rawDrill.segments,
            };

            // [Fix] V2: 使用 pushDrillV2 写入分频道库存
            const drillType = 'S_V_O';
            await inventory.pushDrillV2(userId, candidate.vocabId, drillType, payload);
            successCount++;
        }

        log.info({ correlationId, successCount }, 'Drill V2 入库完成');

        return { success: true, count: successCount, provider };

    } catch (error) {
        log.error({ correlationId, error: (error as Error).message }, 'Drill 生成失败');
        throw error;
    }
}

// --- Helpers ---

interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    word_family: any;
}

async function fetchSpecificCandidates(userId: string, vocabIds: number[]): Promise<DrillCandidate[]> {
    const vocabs = await db.vocab.findMany({
        where: { id: { in: vocabIds } }
    });

    // Maintain order same as input IDs? 
    // Not strictly necessary for batch gen, but mapToCandidate is needed.
    return vocabs.map(mapToCandidate);
}

function mapToCandidate(v: any): DrillCandidate {
    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        word_family: v.word_family,
    };
}

async function getContextWords(targetWord: string): Promise<string[]> {
    const candidates = await db.$queryRaw<Array<{ word: string }>>`
    SELECT word 
    FROM "Vocab"
    WHERE word != ${targetWord}
      AND CHAR_LENGTH(word) > 3
    ORDER BY RANDOM()
    LIMIT 3;
  `;
    return candidates.map((c) => c.word);
}

// [New] Fetch vocabularies that are due for review or new
async function fetchDueCandidates(userId: string, mode: SessionMode, limit: number): Promise<DrillCandidate[]> {
    // [Fix: Race Condition] Fetch extra buffer to account for filtered items
    const bufferLimit = limit * 2;

    // 1. Try fetching "Due" reviews first
    const dueItems = await db.userProgress.findMany({
        where: {
            userId,
            next_review_at: { lte: new Date() },
            // Filter by mode relevance if needed, for now all vocabs can be any mode
        },
        orderBy: { next_review_at: 'asc' },
        take: bufferLimit, // Fetch more than needed
        include: { vocab: true }
    });

    let candidates = dueItems.map(p => mapToCandidate(p.vocab));

    // 2. If not enough, fetch New items (Learning Priority)
    if (candidates.length < bufferLimit) {
        const remaining = bufferLimit - candidates.length;

        // Exclude already learned
        const learnedIds = await db.userProgress.findMany({
            where: { userId },
            select: { vocabId: true }
        }).then(items => items.map(i => i.vocabId));

        const newItems = await db.vocab.findMany({
            where: {
                id: { notIn: learnedIds },
                // [Optional] frequency_score filter?
            },
            take: remaining,
            orderBy: { learningPriority: 'desc' } // Core words first
        });

        candidates = [...candidates, ...newItems.map(mapToCandidate)];
    }

    // 3. [Critical Fix] Filter out candidates that already have inventory
    // This prevents multiple concurrent jobs from generating drills for the same word
    if (candidates.length > 0) {
        const vocabIds = candidates.map(c => c.vocabId);
        const inventoryCounts = await inventory.getInventoryCounts(userId, mode, vocabIds);

        // Filter: Keep only if inventory < 2
        // If inventory is high (e.g. 5), it means another job just populated it.
        const filtered = candidates.filter(c => {
            const count = inventoryCounts[c.vocabId] || 0;
            if (count >= 2) {
                // Determine if we should log every skip? Maybe too noisy.
                return false;
            }
            return true;
        });

        if (filtered.length < candidates.length) {
            log.info(
                { userId, mode, filtered: candidates.length - filtered.length },
                '⚠️ Race Condition Avoided: Skipped candidates with existing inventory'
            );
        }

        candidates = filtered;
    }

    // 4. Return top N
    return candidates.slice(0, limit);
}
