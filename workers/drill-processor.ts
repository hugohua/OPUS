/**
 * Drill 生成处理器 (V2.0 Schedule-Driven)
 */
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { Prisma } from '@prisma/client';
import { DrillJobData } from '@/lib/queue/inventory-queue';
import { Vocab } from '@prisma/client';

import { inventory } from '@/lib/core/inventory';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';
import { SessionMode, BriefingPayload } from '@/types/briefing';
import { AIService } from '@/lib/ai/core';
import { ContextSelector } from '@/lib/ai/context-selector';
import { buildPart5Input, Part5DrillInput } from '@/lib/generators/input-builders';
import { validateL0Payload, createPivotPayload, L0Mode } from '@/lib/validations/l0-schemas';

import { DRILLS_PER_BATCH } from '@/lib/drill-cache';
import { buildPhraseFallbackDrill } from '@/lib/templates/phrase-fallback';
import { auditLLMGeneration, auditInventoryEvent } from '@/lib/services/audit-service'; // [V5.1] Audit

const log = logger.child({ module: 'drill-processor' });

// --- Pivot 配置 (Retry 逻辑待后续实现) ---
const PIVOT_CONFIG = {
    enabled: true, // 启用 Pivot 兜底
};

import { DrillCandidate, BatchDrillOutputSchema } from './types';

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
            // Plan C: Batch Replenishment (不检查 isFull，Emergency 优先)
            log.info({ count: vocabIds.length }, '👉 策略: Plan C (Batch IDs)');
            candidates = await fetchSpecificCandidates(userId, vocabIds);
        } else if (vocabId) {
            // Plan B: Single Emergency (不检查 isFull，Emergency 优先)
            log.info({ vocabId }, '👉 策略: Plan B (Single ID)');
            candidates = await fetchSpecificCandidates(userId, [Number(vocabId)]);
        } else {
            // Generic Fetch: 自动预生成，受 isFull() 限制
            if (job.name.startsWith('generate-')) {
                // [Fix] isFull() 仅拦截自动生成，不影响 Plan B/C Emergency
                if (await inventory.isFull(userId, mode)) {
                    log.warn({ userId, mode }, '🛑 Inventory Full - Early Exit (Token Saved)');
                    return { success: true, count: 0, reason: 'inventory_full_early' };
                }

                log.info({ mode }, '👉 策略: V2 Generic Fetch (Scheduled)');

                // [Defense in Depth] 二次检查 + 审计日志
                if (await inventory.isFull(userId, mode)) {
                    const stats = await inventory.getInventoryStats(userId) as Record<string, number>;
                    const currentCount = stats[mode] || 0;
                    const maxDrills = await inventory.getCapacity(mode);

                    log.warn({ userId, mode, currentCount, maxDrills }, '🛑 Inventory Full - Skipping Auto-Generation');

                    // [Audit] 记录库存满事件
                    auditInventoryEvent(userId, 'FULL', mode, {
                        currentCount,
                        capacity: maxDrills,
                        source: 'auto'
                    });

                    return { success: true, count: 0, reason: 'inventory_full_pre_check' };
                }

                // Dynamic Limit adjustment
                // Re-fetch stats or reuse if we want strictly consistent view, but here fetching fresh capacity is safer for race conditions if we were doing more complex logic, 
                // but actually we just need the numbers for calculation.
                // To keep it simple and clean:
                const capacity = await inventory.getCapacity(mode);
                const stats = await inventory.getInventoryStats(userId) as Record<string, number>;
                const currentCount = stats[mode] || 0;

                const forceLimit = job.data.forceLimit || DRILLS_PER_BATCH; // Default force limit = one batch
                const effectiveLimit = Math.min(forceLimit, capacity - currentCount);

                if (effectiveLimit <= 0) {
                    return { success: true, count: 0, reason: 'inventory_full_effective' };
                }

                candidates = await fetchDueCandidates(userId, mode, effectiveLimit);
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
        const audioGroup: DrillCandidate[] = []; // [L1] Audio
        const phraseGroup: DrillCandidate[] = []; // Reserved
        const contextGroup: DrillCandidate[] = []; // [L2] Context
        const chunkingGroup: DrillCandidate[] = []; // [L1] Chunking
        const nuanceGroup: DrillCandidate[] = []; // [L2] Nuance
        const arenaPart5Group: DrillCandidate[] = []; // [New] ARENA_PART5
        const arenaPart6Group: DrillCandidate[] = []; // [New] ARENA_PART6

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
            } else if (mode === 'PHRASE') {
                phraseGroup.push(...candidates);
            } else if (mode === 'AUDIO') {
                audioGroup.push(...candidates);
            } else if (mode === 'CONTEXT') {
                // [L2] Context Lab
                contextGroup.push(...candidates);
            } else if (mode === 'CHUNKING') {
                // [L1] Chunking (Semantic Rhythms)
                chunkingGroup.push(...candidates);
            } else if (mode === 'NUANCE') {
                // [L2] Nuance (Business Nuance)
                nuanceGroup.push(...candidates);
            } else if (mode === 'ARENA_PART5') {
                // [New] ARENA_PART5
                arenaPart5Group.push(...candidates);
            } else if (mode === 'ARENA_PART6') {
                // [New] ARENA_PART6
                arenaPart6Group.push(...candidates);
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
                const { processSyntaxQueue } = await import('./handlers/basic-handler');
                await processSyntaxQueue(userId, syntaxGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Syntax group')));
        }

        // --- Task B: Process Blitz Group ---
        if (blitzGroup.length > 0) {
            tasks.push((async () => {
                const { processBlitzQueue } = await import('./handlers/basic-handler');
                await processBlitzQueue(blitzGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Blitz group')));
        }

        // --- Task C: Process Phrase Group ---
        if (phraseGroup.length > 0) {
            tasks.push((async () => {
                const { processPhraseQueue } = await import('./handlers/basic-handler');
                await processPhraseQueue(phraseGroup, generatedDrills, mode);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Phrase group')));
        }

        // --- Task F: Process Chunking Group (L1) ---
        if (chunkingGroup.length > 0) {
            tasks.push((async () => {
                const { processChunkingQueue } = await import('./handlers/basic-handler');
                await processChunkingQueue(chunkingGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Chunking group')));
        }

        // --- Task G: Process Nuance Group (L2) ---
        if (nuanceGroup.length > 0) {
            tasks.push((async () => {
                const { processNuanceQueue } = await import('./handlers/basic-handler');
                await processNuanceQueue(nuanceGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Nuance group')));
        }

        // --- Task D: Process Audio Group (L1) ---
        if (audioGroup.length > 0) {
            tasks.push((async () => {
                const { processAudioQueue } = await import('./handlers/audio-handler');
                await processAudioQueue(audioGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Audio group')));
        }

        // --- Task E: Process Context Group (L2) ---
        if (contextGroup.length > 0) {
            tasks.push((async () => {
                const { processContextQueue } = await import('./handlers/context-handler');
                await processContextQueue(userId, contextGroup, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Context group')));
        }

        // --- Task H: Process Arena Part 5 Group ---
        if (arenaPart5Group.length > 0 || mode === 'ARENA_PART5') {
            tasks.push((async () => {
                const { processArenaPart5Queue } = await import('./handlers/part5-handler');
                await processArenaPart5Queue(userId, arenaPart5Group, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Arena Part 5 group')));
        }

        // --- Task I: Process Arena Part 6 Group ---
        if (arenaPart6Group.length > 0 || mode === 'ARENA_PART6') {
            tasks.push((async () => {
                const { processArenaPart6Queue } = await import('./handlers/part6-handler');
                await processArenaPart6Queue(arenaPart6Group, generatedDrills);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Arena Part 6 group')));
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
                    source: 'llm_v2',
                    etymology: candidate.etymology, // [New]
                    // [V7.0] Arena 遥测元数据注入
                    ...(mode === 'ARENA_PART5' && {
                        questionSeedId: item.seedInfo?.id || candidate.reviewData?.seed?.id,
                        questionType: item.seedInfo?.questionType || candidate.reviewData?.seed?.questionType,
                        part: item.seedInfo?.part ?? candidate.reviewData?.seed?.part ?? 5,
                    }),
                    ...(mode === 'ARENA_PART6' && {
                        target_word_blank_index: (rawDrill.meta as any).target_word_blank_index,
                        seed_origin: (rawDrill.meta as any).seed_origin,
                        questionSeedId: item.seedInfo?.id || (rawDrill.meta as any).questionSeedId,
                        questionType: item.seedInfo?.questionType || (rawDrill.meta as any).questionType,
                        part: item.seedInfo?.part ?? (rawDrill.meta as any).part ?? 6,
                    }),
                },
                ...(mode === 'ARENA_PART6' && {
                    passage_markdown: (rawDrill as any).passage_markdown,
                }),
                segments: rawDrill.segments,
            };

            let isPivotLocal = false;

            // --- L0 Schema 验证 (Phase 1: Defense Layer) ---
            const isL0Mode = ['SYNTAX', 'PHRASE', 'BLITZ'].includes(mode);

            // [New] Part5 并非 L0Mode, 所以不需要通过 validateL0Payload 强制打回，
            // 依赖 Zod 在前方的校验或回放。
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
                        isPivotLocal = true;
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

            // --- [V5.1] Panoramic Audit: LLM Generation Logging ---
            auditLLMGeneration(
                userId,
                mode,
                candidate.word,
                payload,
                {
                    provider: item.provider,
                    vocabId: candidate.vocabId,
                    type: candidate.type || 'NEW'
                },
                { isPivotFallback: item.provider === 'fallback' || isPivotLocal }
            );
        }

        // [Audit] 批量入库事件 (循环外一次性记录)
        if (successCount > 0) {
            auditInventoryEvent(userId, 'ADD', mode, {
                currentCount: successCount,
                capacity: 0, // 留空，批量入库时不单独查询
                delta: successCount,
                source: job.name.startsWith('generate-') ? 'auto' : 'emergency'
            });
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


async function fetchSpecificCandidates(userId: string, vocabIds: number[]): Promise<DrillCandidate[]> {
    const vocabs = await db.vocab.findMany({
        where: { id: { in: vocabIds } },
        include: { etymology: true } // [New]
    });
    return vocabs.map(mapToCandidate);
}

function mapToCandidate(v: Vocab): DrillCandidate {
    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        word_family: (v.word_family as Record<string, string>) || {}, // Ensure word_family is a Record
        collocations: v.collocations,
        partOfSpeech: v.partOfSpeech, // [New]
        type: 'NEW', // Default for manual fetch
        reviewData: null,
        confusion_audio: v.confusion_audio || [],
        etymology: (v as any).etymology, // [New]
        phoneticUs: v.phoneticUs, // [New]
        phoneticUk: v.phoneticUk // [New]
    };
}

// [Refactored] getContextWords 已迁移到 lib/generators/input-builders.ts

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
        word_family: (omps.word_family as Record<string, string>) || {}, // Ensure word_family is a Record
        collocations: omps.collocations,
        type: omps.type, // [Smart Dispatch] Pass type
        reviewData: omps.reviewData, // [Smart Dispatch] Pass FSRS data
        partOfSpeech: omps.partOfSpeech, // [New]
        confusion_audio: (omps as any).confusion_audio,
        etymology: (omps as any).etymology,
        phoneticUs: omps.phoneticUs,
        phoneticUk: omps.phoneticUk
    }));

    // 4. [New] 若是 ARENA_PART5，且 candidates 数量不足 limit（或不管足不足都保留30%语法比率）
    if (mode === 'ARENA_PART5') {
        const targetVocabCount = Math.max(0, Math.floor(limit * 0.7)); // 70% 真实词汇
        candidates.splice(targetVocabCount); // 截断真实词汇

        const missing = limit - candidates.length;
        if (missing > 0) {
            // 获取随机无锚点的 QuestionSeed 作为纯语法题兜底
            const pureGrammarSeeds = await db.questionSeed.findMany({
                where: { anchorVocabId: null, part: 5 },
                take: missing * 2, // Take more for random selection
                orderBy: { usedCount: 'asc' } // Prioritize least used
            });

            // Randomly select 'missing' number of seeds
            const selectedSeeds = pureGrammarSeeds
                .sort(() => 0.5 - Math.random())
                .slice(0, missing);

            for (const seed of selectedSeeds) {
                candidates.push({
                    vocabId: -Number(seed.id.replace(/\D/g, '').slice(0, 8) || Math.floor(Math.random() * 99999)), // 伪造负数 ID 标记此为纯语法补充词
                    word: seed.targetAnswer,
                    definition_cn: '',
                    word_family: {} as Record<string, string>, // Ensure word_family is a Record
                    collocations: [],
                    partOfSpeech: null,
                    confusion_audio: null,
                    etymology: null,
                    phoneticUs: undefined,
                    phoneticUk: undefined,
                    type: 'NEW',
                    reviewData: { seed }, // 将 seed 藏在 reviewData 中向下传递
                });
            }
        }
        return candidates;
    }

    // 5. 返回指定数量
    return candidates.slice(0, limit);
}

