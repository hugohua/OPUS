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
            // Legacy V1: Generic Fetch (Deprecate soon, but keep for fallback)
            // But V2 plan focuses on Schedule-Driven. 
            // If explicit params missing, maybe we shouldn't run?
            // Let's keep specific fallback logic if needed, or just return.
            // For now, let's assume if no explicit IDs, we skip or use V1 legacy if you insist. 
            // Since we upgraded everything, let's be strict.
            if (job.name === 'replenish_one' || job.name === 'replenish_batch') {
                log.warn('Job missing vocabId(s), skipping');
                return { success: false, reason: 'missing_ids' };
            }
            // V1 Fallback (to support legacy jobs if any lingering in queue)
            // candidates = await fetchCandidates_Legacy(userId, 10, mode);
            return { success: false, reason: 'legacy_not_supported_v2' };
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
        const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
        let parsedData;
        try {
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            log.error({ correlationId, text: text.slice(0, 500) }, 'JSON 解析失败');
            throw new Error('AI response was not valid JSON');
        }

        const result = BatchDrillOutputSchema.safeParse(parsedData);
        if (!result.success) {
            log.error({ correlationId, errors: result.error }, 'Schema 验证失败');
            throw new Error('AI response did not match schema');
        }

        // ============================================
        // 4. 保存到 V2 Inventory (Redis)
        // ============================================
        const generatedDrills = result.data.drills;
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
