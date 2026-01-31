/**
 * Drill 生成处理器 (V2.0 Schedule-Driven)
 */
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { Prisma } from '@prisma/client';
import { DrillJobData } from '@/lib/queue/inventory-queue';
import { Vocab } from '@prisma/client';
import { generateWithFailover } from './llm-failover';
// import { getDrillBatchPrompt } from '@/lib/prompts/drill'; // Legacy removed
import { inventory } from '@/lib/inventory';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';
import { SessionMode, BriefingPayload } from '@/types/briefing';
import { safeParse } from '@/lib/ai/utils';
import { ContextSelector } from '@/lib/ai/context-selector';
import { validateL0Payload, createPivotPayload, L0Mode } from '@/lib/validations/l0-schemas';

const log = logger.child({ module: 'drill-processor' });

// --- Pivot 配置 (Retry 逻辑待后续实现) ---
const PIVOT_CONFIG = {
    enabled: true, // 启用 Pivot 兜底
};

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

    log.info({
        correlationId,
        userId,
        mode,
        jobName: job.name,
        vocabIds: vocabIds?.length
    }, '🔄 [Worker] 收到任务 (Job Received)');

    try {
        // ============================================
        // 1. 确定生成目标 (Candidates)
        // ============================================
        let candidates: DrillCandidate[] = [];

        if (vocabIds && vocabIds.length > 0) {
            // Plan C: Batch Replenishment
            log.info({ count: vocabIds.length }, '👉 策略: Plan C (Batch IDs)');
            candidates = await fetchSpecificCandidates(userId, vocabIds);
        } else if (vocabId) {
            // Plan B: Single Emergency Replenishment
            log.info({ vocabId }, '👉 策略: Plan B (Single ID)');
            candidates = await fetchSpecificCandidates(userId, [Number(vocabId)]);
        } else {
            // [Fix] V2 Generic Fetch (Schedule-Driven)
            if (job.name.startsWith('generate-')) {
                log.info({ mode }, '👉 策略: V2 Generic Fetch (Scheduled)');
                const limit = job.data.forceLimit || 10;
                candidates = await fetchDueCandidates(userId, mode, limit);
            } else {
                log.warn({ jobName: job.name }, '❌ 未知任务类型，跳过');
                return { success: false, reason: 'legacy_not_supported_v2' };
            }
        }

        if (candidates.length === 0) {
            log.warn({ correlationId }, '⚠️ 无可用候选词 (Candidates Empty)');
            return { success: false, reason: 'no_candidates' };
        }

        log.info({ count: candidates.length }, '✅ 锁定候选词 (Candidates Locked)');

        // ============================================
        // 2. 智能路由 & 分组生成 (Smart Dispatch)
        // ============================================

        const syntaxGroup: DrillCandidate[] = [];
        const blitzGroup: DrillCandidate[] = [];
        const phraseGroup: DrillCandidate[] = []; // Reserved for AUDIO mappings if needed

        // Routing Logic
        if (mode === 'SYNTAX') {
            for (const c of candidates) {
                // FSRS Rule: 
                // Stage 1 (New) -> Syntax (S-V-O)
                // Stage 2 (Review < 7d) -> Syntax (POS Trap)
                // Stage 3 (Review >= 7d) -> Blitz (Collocations / Visual Trap)

                const isReview = c.type === 'REVIEW';
                const stability = c.reviewData?.stability || 0;

                if (!isReview || stability < 7) {
                    syntaxGroup.push(c);
                } else {
                    blitzGroup.push(c);
                }
            }
            log.info({
                total: candidates.length,
                syntaxParams: syntaxGroup.length,
                blitzParams: blitzGroup.length
            }, '🔀 [Smart Dispatch] Grouped candidates based on FSRS');
        } else {
            // Fallback / Other Modes
            if (mode === 'BLITZ') {
                blitzGroup.push(...candidates);
            } else if (mode === 'PHRASE' || mode === 'AUDIO') {
                phraseGroup.push(...candidates);
            } else {
                // Default fallback to Syntax
                syntaxGroup.push(...candidates);
            }
        }

        // ============================================
        // 3. 执行生成 (Parallel Execution)
        // ============================================

        const generatedDrills: any[] = [];
        let primaryProvider = 'unknown';

        const tasks: Promise<void>[] = [];

        // --- Task A: Process Syntax Group ---
        if (syntaxGroup.length > 0) {
            tasks.push((async () => {
                const { getL0SyntaxBatchPrompt } = await import('@/lib/generators/l0/syntax');
                const inputs = await Promise.all(syntaxGroup.map(c => mapToSyntaxInput(userId, c)));
                const p = getL0SyntaxBatchPrompt(inputs);

                const { text, provider } = await generateWithFailover(p.system, p.user);
                primaryProvider = provider;

                const result = safeParse(text, BatchDrillOutputSchema, {
                    model: provider,
                    systemPrompt: p.system,
                    userPrompt: p.user
                });

                // Map results back to candidates 
                // Assumes LLM respects order. Drill output is array.
                result.drills.forEach((drill, idx) => {
                    // Safety check index
                    if (idx < syntaxGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: syntaxGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Syntax group')));
        }

        // --- Task B: Process Blitz Group ---
        if (blitzGroup.length > 0) {
            tasks.push((async () => {
                const { getL0BlitzBatchPrompt } = await import('@/lib/generators/l0/blitz');
                const inputs = blitzGroup.map(c => {
                    let collys: string[] = [];
                    if (Array.isArray(c.collocations)) {
                        collys = c.collocations.map((item: any) => typeof item === 'string' ? item : item.text).filter(Boolean);
                    }
                    return {
                        targetWord: c.word,
                        meaning: c.definition_cn || '',
                        collocations: collys
                    };
                });
                const p = getL0BlitzBatchPrompt(inputs);

                const { text, provider } = await generateWithFailover(p.system, p.user);

                const result = safeParse(text, BatchDrillOutputSchema, {
                    model: provider,
                    systemPrompt: p.system,
                    userPrompt: p.user
                });

                result.drills.forEach((drill, idx) => {
                    if (idx < blitzGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: blitzGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Blitz group')));
        }

        // --- Task C: Process Phrase Group (if any) ---
        if (phraseGroup.length > 0) {
            tasks.push((async () => {
                const { getL0PhraseBatchPrompt } = await import('@/lib/generators/l0/phrase');
                const inputs = await Promise.all(phraseGroup.map(async c => {
                    const modifiers = await getContextWords(userId, c.vocabId, c.word);
                    return {
                        targetWord: c.word,
                        meaning: c.definition_cn || '暂无释义',
                        modifiers: modifiers.length > 0 ? modifiers : ['frequently', 'highly', 'effectively']
                    };
                }));
                const p = getL0PhraseBatchPrompt(inputs);

                const { text, provider } = await generateWithFailover(p.system, p.user);

                const result = safeParse(text, BatchDrillOutputSchema, {
                    model: provider,
                    systemPrompt: p.system,
                    userPrompt: p.user
                });

                result.drills.forEach((drill, idx) => {
                    if (idx < phraseGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: phraseGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Phrase group')));
        }

        await Promise.all(tasks);

        log.info({ generatedCount: generatedDrills.length }, '✅ LLM 生成完成 (All Groups)');

        // ============================================
        // 4. 保存到 V2 Inventory (Redis) + L0 Schema 验证
        // ============================================
        let successCount = 0;
        let pivotCount = 0;

        for (const item of generatedDrills) {
            const { drill: rawDrill, candidate } = item;

            // 构建初始 Payload
            let payload: BriefingPayload = {
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

            // --- L0 Schema 验证 (Phase 1: Defense Layer) ---
            const isL0Mode = ['SYNTAX', 'PHRASE', 'BLITZ'].includes(mode);

            if (isL0Mode) {
                const validation = validateL0Payload(mode as L0Mode, payload);

                if (!validation.success) {
                    log.warn({
                        vocabId: candidate.vocabId,
                        word: candidate.word,
                        mode,
                        error: validation.error,
                        rawPayload: JSON.stringify(validation.rawPayload).slice(0, 500), // 截断日志
                    }, '⚠️ L0 Schema 验证失败');

                    // Pivot 兜底: 使用安全 Payload
                    if (PIVOT_CONFIG.enabled) {
                        payload = createPivotPayload(
                            mode as L0Mode,
                            candidate.vocabId,
                            candidate.word,
                            'Generation failed, please retry.'
                        );
                        pivotCount++;
                        log.info({ vocabId: candidate.vocabId, word: candidate.word }, '🔄 使用 Pivot 兜底 Payload');
                    } else {
                        // 不使用 Pivot 时跳过此条目
                        log.warn({ vocabId: candidate.vocabId }, '❌ 跳过无效 Payload (Pivot 已禁用)');
                        continue;
                    }
                }
            }

            await inventory.pushDrill(userId, mode, candidate.vocabId, payload);
            successCount++;

            // [Phase 5] Real-time Stream Publish & Persist
            // Fire and forget - do not block main flow
            const streamEvent = JSON.stringify({
                id: `GEN-${crypto.randomUUID().split('-')[0]}`, // Short unique ID
                timestamp: new Date().toISOString(),
                payload: payload,
                status: 'success',
                debug: {
                    systemPrompt: item.systemPrompt,
                    userPrompt: item.userPrompt,
                    model: item.provider
                }
            });

            Promise.all([
                redis.publish('admin:drill-stream', streamEvent),
                redis.lpush('admin:drill-history', streamEvent),
                redis.ltrim('admin:drill-history', 0, 99) // Keep last 100
            ]).catch(err => log.error({ err }, 'Failed to publish/persist stream event'));
        }

        if (pivotCount > 0) {
            log.warn({ correlationId, pivotCount, successCount }, '⚠️ 部分 Drill 使用了 Pivot 兜底');
        }

        log.info({ correlationId, successCount }, 'Drill V2 入库完成');

        return { success: true, count: successCount, pivotCount, provider: primaryProvider };

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
    collocations?: any;
    type?: 'NEW' | 'REVIEW'; // [Smart Dispatch] Added
    reviewData?: any;        // [Smart Dispatch] Added
}

async function fetchSpecificCandidates(userId: string, vocabIds: number[]): Promise<DrillCandidate[]> {
    const vocabs = await db.vocab.findMany({
        where: { id: { in: vocabIds } }
    });
    return vocabs.map(mapToCandidate);
}

function mapToCandidate(v: Vocab): DrillCandidate {
    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        word_family: v.word_family,
        collocations: v.collocations,
        type: 'NEW', // Default for manual fetch
        reviewData: null
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
        [], // excludeIds
        mode // [Fix] Pass mode to determine track
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
        collocations: omps.collocations,
        type: omps.type, // [Smart Dispatch] Pass type
        reviewData: omps.reviewData // [Smart Dispatch] Pass FSRS data
    }));

    // 4. 返回指定数量
    return candidates.slice(0, limit);
}

// --- Helper: Input Mappers ---

async function mapToSyntaxInput(userId: string, c: DrillCandidate) {
    const contextWords = await getContextWords(userId, c.vocabId, c.word);
    return {
        targetWord: c.word,
        meaning: c.definition_cn || '暂无释义',
        contextWords,
        wordFamily: (c.word_family as Record<string, string>) || { v: c.word },
    };
}
