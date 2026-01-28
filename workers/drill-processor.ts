/**
 * Drill 生成处理器 (V2.0 Schedule-Driven)
 */
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DrillJobData } from '@/lib/queue/inventory-queue';
import { Vocab } from '@prisma/client';
import { generateWithFailover } from './llm-failover';
import { getDrillBatchPrompt } from '@/lib/prompts/drill';
import { inventory } from '@/lib/inventory';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { SessionMode, BriefingPayload } from '@/types/briefing';
import { safeParse } from '@/lib/ai/utils';
import { ContextSelector } from '@/lib/ai/context-selector';

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
    definition_cn: string | null;
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

function mapToCandidate(v: Vocab): DrillCandidate {
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
    try {
        const selectorResult = await ContextSelector.select(userId, targetVocabId, {
            count: 3,
            strategies: ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'],
            minDistance: 0.15,
            maxDistance: 0.5,
            excludeIds: [targetVocabId]
        });

        return selectorResult.map(v => v.word);
    } catch (e) {
        log.error({ error: String(e), targetWord }, 'ContextSelector failed, returning empty');
        return [];
    }
}

/**
 * 获取需要预生成的候选词
 * [重构] 现在直接使用 OMPS 选词逻辑，确保生产和消费使用相同的策略
 */
async function fetchDueCandidates(userId: string, mode: SessionMode, limit: number): Promise<DrillCandidate[]> {
    // 导入 OMPS 选词引擎
    const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');

    // 配置词性过滤（与 get-next-drill.ts 保持一致）
    let posFilter: string[] | undefined;
    if (mode === 'SYNTAX') {
        posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞'];
    }

    // 1. 使用 OMPS 获取候选词（与消费侧逻辑完全一致）
    const bufferLimit = limit * 2; // 获取2倍数量，用于过滤
    const ompsCandidates = await fetchOMPSCandidates(
        userId,
        bufferLimit,
        { posFilter },
        [] // excludeIds
    );

    if (ompsCandidates.length === 0) {
        return [];
    }

    // 2. 过滤出库存不足的单词（避免重复生成）
    const vocabIds = ompsCandidates.map(c => c.vocabId);
    const inventoryCounts = await inventory.getInventoryCounts(userId, mode, vocabIds);

    const needsGeneration = ompsCandidates.filter(c => {
        const count = inventoryCounts[c.vocabId] || 0;
        return count < 2; // 库存 < 2 才需要生成
    });

    if (needsGeneration.length < ompsCandidates.length) {
        log.info(
            { userId, mode, skipped: ompsCandidates.length - needsGeneration.length },
            '✅ 跳过已有库存的单词'
        );
    }

    // 3. 转换为 DrillCandidate 格式
    const candidates = needsGeneration.map(omps => ({
        vocabId: omps.vocabId,
        word: omps.word,
        definition_cn: omps.definition_cn,
        word_family: omps.word_family,
    }));

    // 4. 返回指定数量
    return candidates.slice(0, limit);
}
