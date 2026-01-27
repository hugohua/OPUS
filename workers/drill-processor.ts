/**
 * Drill 生成处理器 (V2.0 Schedule-Driven)
 */
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
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
                const contextWords = await getContextWords(userId, c.vocabId, c.word);
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
                    source: 'llm_v2'
                },
                segments: rawDrill.segments,
            };

            await inventory.pushDrill(userId, mode, candidate.vocabId, payload);
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

/**
 * 获取上下文单词 (The "N" in "1+N")
 * 策略 (Hybrid):
 * 1. 尝试从 UserProgress (Learning/Review) 中找语义相关的 (Vector Search)
 * 2. 如果不足 3 个，从 Global Vocab 中找语义相关的 (Vector Search)
 * 3. 兜底：随机选择
 */
async function getContextWords(userId: string, targetVocabId: number, targetWord: string): Promise<string[]> {
    const desiredCount = 3;
    let candidates: string[] = [];

    try {
        // 0. Check if target has embedding
        const hasEmbedding = await db.$queryRaw<{ exists: boolean }[]>`
            SELECT EXISTS (
                SELECT 1 FROM "Vocab" 
                WHERE id = ${targetVocabId} AND embedding IS NOT NULL
            );
        `;

        // Note: db.$queryRaw returns an array of objects.
        if (hasEmbedding?.[0]?.exists) {
            // Strategy 1: Vector Search in User Review Queue
            // reinforcing known words in new contexts
            const reviewMatches = await db.$queryRaw<{ word: string }[]>`
                SELECT v.word
                FROM "UserProgress" up
                JOIN "Vocab" v ON up."vocabId" = v.id
                WHERE up."userId" = ${userId}
                  AND up.status IN ('LEARNING', 'REVIEW')
                  AND v.id != ${targetVocabId}
                  AND v.embedding IS NOT NULL
                ORDER BY v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetVocabId})
                LIMIT ${desiredCount};
            `;

            if (Array.isArray(reviewMatches)) {
                candidates.push(...reviewMatches.map(c => c.word));
            }

            // Strategy 2: Vector Search in Global Vocab (if needed)
            if (candidates.length < desiredCount) {
                const limit = desiredCount - candidates.length;

                const exclusion = candidates.length > 0
                    ? Prisma.sql`AND word NOT IN (${Prisma.join(candidates)})`
                    : Prisma.empty;

                const globalMatches = await db.$queryRaw<{ word: string }[]>`
                    SELECT word
                    FROM "Vocab"
                    WHERE id != ${targetVocabId}
                      AND embedding IS NOT NULL
                      ${exclusion}
                    ORDER BY embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetVocabId})
                    LIMIT ${limit};
                `;

                if (Array.isArray(globalMatches)) {
                    candidates.push(...globalMatches.map(c => c.word));
                }
            }
        }
    } catch (e) {
        log.warn({ error: String(e), targetWord }, 'Vector search failed, falling back to random');
    }

    // Strategy 3: Random Fallback (if vector search failed or returned 0)
    if (candidates.length < desiredCount) {
        const remaining = desiredCount - candidates.length;

        const exclusion = candidates.length > 0
            ? Prisma.sql`AND word NOT IN (${Prisma.join(candidates)})`
            : Prisma.empty;

        const randoms = await db.$queryRaw<Array<{ word: string }>>`
            SELECT word 
            FROM "Vocab"
            WHERE word != ${targetWord}
              AND CHAR_LENGTH(word) > 3
              ${exclusion} 
            ORDER BY RANDOM()
            LIMIT ${remaining};
        `;

        if (Array.isArray(randoms)) {
            candidates.push(...randoms.map((c) => c.word));
        }
    }

    return candidates.slice(0, desiredCount);
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
