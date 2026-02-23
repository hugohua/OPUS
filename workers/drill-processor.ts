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
import { buildSyntaxInput, buildPhraseInput, buildBlitzInputWithTraps, buildPart5Input, Part5DrillInput } from '@/lib/generators/input-builders';
import { VocabEntity, CollocationItem } from '@/types/vocab';
import { validateL0Payload, createPivotPayload, L0Mode } from '@/lib/validations/l0-schemas';
import { DRILLS_PER_BATCH } from '@/lib/drill-cache';
import { getL1AudioScriptPrompt, AudioScriptInput } from '@/lib/generators/l1/audio-script';
import { getL2ContextBatchPrompt, ContextGeneratorInput, ContextStage } from '@/lib/generators/l2/context-script';
import { buildPhraseFallbackDrill } from '@/lib/templates/phrase-fallback';
import { buildChunkingDrillFallback } from '@/lib/templates/deterministic-drill'; // [B1 Fix] Pivot Fallback
import { VisualTrapService } from '@/lib/services/visual-trap'; // [Phase 5]
import { auditLLMGeneration, auditInventoryEvent } from '@/lib/services/audit-service'; // [V5.1] Audit

const log = logger.child({ module: 'drill-processor' });

// --- Pivot 配置 (Retry 逻辑待后续实现) ---
const PIVOT_CONFIG = {
    enabled: true, // 启用 Pivot 兜底
};

// AI 输出 Schema (Reusable)
const SingleDrillSchema = z.object({
    meta: z.object({
        format: z.string().optional(), // Relaxed to allow LLM variation (was enum)
        // mode: z.enum(['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ']), // Optional in LLM response, inferred from context
        target_word: z.string().optional(),
    }),
    segments: z.array(z.any()),
});

const BatchDrillOutputSchema = z.object({
    items: z.array(SingleDrillSchema),
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
                const inputs = await Promise.all(syntaxGroup.map(c => buildSyntaxInput(userId, c as VocabEntity)));
                const p = getL0SyntaxBatchPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast',
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });
                primaryProvider = provider;

                // Map results back to candidates 
                // Assumes LLM respects order. Drill output is array.
                result.items.forEach((drill, idx) => {
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

                // 使用共享 buildBlitzInputWithTraps（含 VisualTrapService 调用和 Fail-Safe）
                const inputs = await Promise.all(
                    blitzGroup.map(c => buildBlitzInputWithTraps(c as VocabEntity))
                );

                const p = getL0BlitzBatchPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast',
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill, idx) => {
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

        // --- Task C: Process Phrase Group (Hybrid: DB First -> LLM Fallback) ---
        if (phraseGroup.length > 0) {
            tasks.push((async () => {
                const { getL0PhraseBatchPrompt } = await import('@/lib/generators/l0/phrase');
                const { buildPhraseDrill } = await import('@/lib/templates/phrase-drill');

                const llmCandidates: DrillCandidate[] = [];

                // 1. Try DB First (Deterministic)
                for (const c of phraseGroup) {
                    // Map DrillCandidate to partial Vocab for builder
                    const vocabLike = {
                        id: c.vocabId,
                        word: c.word,
                        definition_cn: c.definition_cn,
                        phoneticUs: c.phoneticUs,
                        partOfSpeech: c.partOfSpeech,
                        collocations: c.collocations,
                        commonExample: c.commonExample,
                        etymology: c.etymology
                    } as any;

                    const dbDrill = buildPhraseDrill(vocabLike);

                    if (dbDrill) {
                        generatedDrills.push({
                            drill: buildPhraseFallbackDrill({
                                id: c.vocabId,
                                word: c.word,
                                definition_cn: c.definition_cn,
                                commonExample: c.commonExample,
                                collocations: c.collocations as CollocationItem[]
                            }, mode),
                            candidate: c,
                            systemPrompt: 'DB_FIRST',
                            userPrompt: 'DB_FIRST',
                            provider: 'db_collocation'
                        });
                    } else {
                        llmCandidates.push(c);
                    }
                }

                if (llmCandidates.length === 0) return;

                // 2. LLM Fallback for remaining candidates
                log.info({ count: llmCandidates.length }, '⚠️ Phrase DB miss, falling back to LLM');

                const inputs = llmCandidates.map(c => buildPhraseInput(c as VocabEntity));
                const p = getL0PhraseBatchPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'smart', // Phrase might need more nuance
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill, idx) => {
                    if (idx < llmCandidates.length) {
                        generatedDrills.push({
                            drill,
                            candidate: llmCandidates[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Phrase group')));
        }

        // --- Task F: Process Chunking Group (L1) ---
        if (chunkingGroup.length > 0) {
            tasks.push((async () => {
                const { getL1ChunkingBatchPrompt } = await import('@/lib/generators/l1/chunking');
                const inputs = chunkingGroup.map(c => ({
                    sentence: c.commonExample || `The ${c.word} is essential for success.`,
                    targetWord: c.word
                }));
                const p = getL1ChunkingBatchPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast',
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill, idx) => {
                    if (idx < chunkingGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: chunkingGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Chunking group')));
        }

        // --- Task G: Process Nuance Group (L2) ---
        if (nuanceGroup.length > 0) {
            tasks.push((async () => {
                const { getL2NuanceBatchPrompt } = await import('@/lib/generators/l2/nuance');
                const inputs = nuanceGroup.map(c => ({
                    targetWord: c.word,
                    meaning: c.definition_cn || '',
                    synonyms: c.synonyms || [],
                    scenario: c.scenario || 'business communication'
                }));
                const p = getL2NuanceBatchPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast', // Unified to Fast for all user-facing drills
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill, idx) => {
                    if (idx < nuanceGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: nuanceGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Nuance group')));
        }

        // --- Task D: Process Audio Group (L1) ---
        if (audioGroup.length > 0) {
            tasks.push((async () => {
                const inputs = audioGroup.map(mapToAudioInput);
                const p = getL1AudioScriptPrompt(inputs);

                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast',
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill, idx) => {
                    if (idx < audioGroup.length) {
                        generatedDrills.push({
                            drill,
                            candidate: audioGroup[idx],
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider
                        });
                    }
                });
            })().catch(err => log.error({ error: err.message }, 'Failed to process Audio group')));
        }

        // --- Task E: Process Context Group (L2) ---
        if (contextGroup.length > 0) {
            tasks.push((async () => {
                // Group by Stage for batch efficiency
                const stage1Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];
                const stage2Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];
                const stage3Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];

                // Parallel context word fetching
                await Promise.all(contextGroup.map(async c => {
                    const related = await ContextSelector.select(userId, c.vocabId, {
                        count: 3,
                        minDistance: 0.2,  // TASK3.md: 0.2-0.4 range
                        maxDistance: 0.4
                    });

                    // 🎯 3-Stage Routing (TASK3.md)
                    const stability = c.reviewData?.stability || 0;
                    const lapses = c.reviewData?.lapses || 0;
                    const isCritical = lapses >= 3; // 3+ lapses = Critical
                    let stage: ContextStage = 1;
                    if (stability >= 45 && !isCritical) stage = 2;
                    if (isCritical) stage = 3;

                    const input: ContextGeneratorInput & { candidate: DrillCandidate } = {
                        targetWord: c.word,
                        meaning: c.definition_cn || '暂无释义',
                        contextWords: related.map(r => r.word),
                        synonyms: c.synonyms || [],  // B3 Fix: Use type-safe access
                        scenario: c.scenario || 'general office',
                        stage,
                        candidate: c
                    };

                    if (stage === 1) stage1Inputs.push(input);
                    else if (stage === 2) stage2Inputs.push(input);
                    else stage3Inputs.push(input);
                }));

                log.info({ stage1: stage1Inputs.length, stage2: stage2Inputs.length, stage3: stage3Inputs.length }, '🔀 [L2] Context Stage Distribution');

                // 🛑 B1 Fix: Pivot 兜底函数
                const processStageBatch = async (
                    inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[],
                    stageNum: ContextStage
                ) => {
                    if (inputs.length === 0) return;

                    try {
                        const p = getL2ContextBatchPrompt(inputs, stageNum);
                        const { object: result, provider } = await AIService.generateObject({
                            mode: 'fast', // Unified to Fast (User request: Context is short enough)
                            schema: BatchDrillOutputSchema,
                            system: p.system,
                            prompt: p.user
                        });

                        result.items.forEach((drill, idx) => {
                            if (idx < inputs.length) {
                                generatedDrills.push({ drill, candidate: inputs[idx].candidate, systemPrompt: p.system, userPrompt: p.user, provider });
                            }
                        });
                    } catch (err: any) {
                        // 🛑 Pivot Rule: LLM 失败时使用确定性兜底
                        log.warn({ error: err.message, stage: stageNum, count: inputs.length }, '[L2] Stage LLM failed, using Pivot fallback');

                        for (const input of inputs) {
                            const fallbackDrill = buildPhraseFallbackDrill({
                                id: input.candidate.vocabId,
                                word: input.candidate.word,
                                definition_cn: input.candidate.definition_cn,
                                commonExample: input.candidate.commonExample,
                                collocations: input.candidate.collocations,
                                partOfSpeech: input.candidate.partOfSpeech // [New]
                            }, 'CONTEXT');
                            generatedDrills.push({ drill: fallbackDrill, candidate: input.candidate, systemPrompt: '', userPrompt: '', provider: 'fallback' });
                        }
                    }
                };

                // Generate per stage (parallel with Pivot protection)
                await Promise.all([
                    processStageBatch(stage1Inputs, 1),
                    processStageBatch(stage2Inputs, 2),
                    processStageBatch(stage3Inputs, 3)
                ]);
            })().catch(err => log.error({ error: err.message }, 'Failed to process Context group')));
        }

        // --- Task H: Process Arena Part 5 Group ---
        if (arenaPart5Group.length > 0 || mode === 'ARENA_PART5') {
            tasks.push((async () => {
                const { getPart5DrillBatchPrompt, buildArenaPart5Inputs } = await import('@/lib/generators/arena/part5-drill');
                const { buildWeightedTypePicker, getWeakestGrammarNodesRaw } = await import('@/lib/services/diagnostic-service');

                // [V7.0] 漏斗第一层：宏观大题型调度引擎 (基于历史错误率加权)
                const pickTypeFn = await buildWeightedTypePicker(userId);
                // [V7.0] 漏斗第二层：微观语法结构追踪引擎 (BKT 筛选弹药库)
                const weakNodeIds = await getWeakestGrammarNodesRaw(userId, 5); // 提取最薄弱的 5 个语法树节点

                const directPivotDrills = [];
                const realCandidates = [];

                // 区分来源于 OMPS 真实词库的 candidate 和纯语法的假 candidate
                for (const c of arenaPart5Group) {
                    if (c.vocabId < 0 && c.reviewData?.seed) {
                        directPivotDrills.push({ candidate: c, seed: c.reviewData.seed });
                    } else {
                        realCandidates.push(c);
                    }
                }

                // 一键处理真词候选项的 DB 查询与 Seed 重组，注入双漏斗引擎选型参数
                let llmInputs: { candidate: any; input: any }[] = [];
                if (realCandidates.length > 0) {
                    llmInputs = await buildArenaPart5Inputs(realCandidates, pickTypeFn, weakNodeIds);
                }

                // 3. 执行 LLM 生成 (分批处理，每次 2 词，防 API 限流与 LLM 串线)
                if (llmInputs.length > 0) {
                    const CHUNK_SIZE = 2;
                    for (let i = 0; i < llmInputs.length; i += CHUNK_SIZE) {
                        const chunk = llmInputs.slice(i, i + CHUNK_SIZE);
                        const p = getPart5DrillBatchPrompt(chunk.map(item => item.input));

                        try {
                            const { object: result, provider } = await AIService.generateObject({
                                mode: 'fast',
                                schema: BatchDrillOutputSchema,
                                system: p.system,
                                prompt: p.user
                            });

                            result.items.forEach((drill, idx) => {
                                if (idx < chunk.length) {
                                    generatedDrills.push({
                                        drill,
                                        candidate: chunk[idx].candidate,
                                        systemPrompt: p.system,
                                        userPrompt: p.user,
                                        provider: provider,
                                        // [V7.0] 保留 seed 元数据用于遥测
                                        seedInfo: {
                                            id: chunk[idx].input.seed?.id,
                                            questionType: chunk[idx].input.seed?.questionType,
                                            part: chunk[idx].input.seed?.part ?? 5,
                                        }
                                    });
                                }
                            });
                        } catch (err: any) {
                            log.error({ error: err.message, chunkIndex: i / CHUNK_SIZE }, 'Failed to process Arena Part 5 chunk (LLM), using raw seeds as fallback');
                            // Fallback: Use the raw seeds directly for this specific failed chunk
                            for (const item of chunk) {
                                directPivotDrills.push({ candidate: item.candidate, seed: item.input.seed });
                            }
                        }
                    }
                }

                // 4. 处理直接兜底（纯语法题 或 LLM 失败项）
                for (const pivot of directPivotDrills) {
                    const seed = pivot.seed;
                    // 组装 BriefingPayload 结构
                    const fallbackDrill = {
                        meta: {
                            mode: 'ARENA_PART5',
                            target_word: pivot.candidate.word || seed.targetAnswer,
                        },
                        segments: [
                            {
                                type: 'text',
                                content_markdown: seed.sentence.replace('_______', seed.targetAnswer), // Full sentence
                            },
                            {
                                type: 'interaction',
                                dimension: 'V', // Visual track default
                                task: {
                                    style: 'swipe_card',
                                    question_markdown: seed.sentence,
                                    options: seed.options,
                                    answer_key: seed.targetAnswer,
                                    explanation_markdown: seed.rationale || '正确选项符合该句的语法及语境要求。' // Might be missing in some raw DB
                                }
                            }
                        ]
                    };

                    generatedDrills.push({
                        drill: fallbackDrill,
                        candidate: pivot.candidate,
                        systemPrompt: 'PIVOT_FALLBACK',
                        userPrompt: 'PIVOT_FALLBACK',
                        provider: 'db_seed_fallback'
                    });
                }
            })().catch(err => log.error({ error: err.message }, 'Failed to process Arena Part 5 group')));
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
                },
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

interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string | null;
    word_family: any;
    collocations?: any;
    type?: 'NEW' | 'REVIEW';
    reviewData?: any;
    confusion_audio?: string[];
    // [L2 B3 Fix] 添加 synonyms 和 scenario 支持
    synonyms?: string[];
    scenario?: string;
    commonExample?: string | null;
    partOfSpeech?: string | null; // [New]
    etymology?: any; // [New]
    phoneticUs?: string | null; // [New]
    phoneticUk?: string | null; // [New]
}

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

// --- Helper: Input Mappers ---

// [Refactored] mapToSyntaxInput 已迁移到 lib/generators/input-builders.ts (buildSyntaxInput)

function mapToAudioInput(c: DrillCandidate): AudioScriptInput {
    // Extract FSRS parameters
    const stability = c.reviewData?.stability || 0;
    const difficulty = c.reviewData?.difficulty || 5;

    // TODO: Extract confusion_audio from Vocab (need to ensure it is fetched in fetchSpecificCandidates/fetchDueCandidates)
    // Currently DrillCandidate does not have confusion_audio
    // We update DrillCandidate interface and fetch logic below?
    // Or just fetch it here individually?
    // Ideally we update DrillCandidate.
    // For now, default to empty array or fetch if critically needed (Stage 4).
    // Given the fetch logic is separate, let's assume DrillCandidate interface update is too expensive right now,
    // so we will pass [] and fix fetch logic next step if Stage 4 is high priority.
    // Actually, confusion_audio IS needed for Stage 4.
    // Let's rely on mapping logic to handle it if available.

    // NOTE: Fetch logic (Step 432) returns DrillCandidate.
    // We need to verify if confusion_audio is fetched.
    // 'fetchOMPSCandidates' fetches from Vocab. 
    // OMPS usually returns minimal fields. 
    // Let's assume confusion_audio is NOT in OMPS result yet. 
    // We will modify mapToCandidate/fetchDueCandidates next to include it.

    return {
        word: c.word,
        stability,
        difficulty,
        confusion_audio: (c as any).confusion_audio || [] // Use type assertion for now
    };
}
