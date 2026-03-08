'use server';

/**
 * Session Drill 批量获取 Action
 * 
 * 功能：
 *   获取下一批 Drill 卡片，供 Session 模式使用。
 *   使用 OMPS 策略选词，通过 Redis 缓存获取内容。
 */

import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BriefingPayload, SessionMode, SingleScenarioMode } from '@/types/briefing';
import { GetBriefingSchema, GetBriefingInput } from '@/lib/validations/briefing';
import { inventory } from '@/lib/core/inventory';
import { buildChunkingDrillFallback } from '@/lib/templates/deterministic-drill';
import { buildArenaFallbackDrill } from '@/lib/templates/arena-fallback';
import { buildPhraseFallbackDrill } from '@/lib/templates/phrase-fallback';
import { shuffleBriefingOptions } from '@/lib/core/shuffle-options';
import { fetchOMPSCandidates, OMPSCandidate } from '@/lib/services/omps-core';
import { auditInventoryEvent, auditSessionFallback, auditMixedModeDistribution } from '@/lib/services/audit-service';
import { isMixedMode, MIXED_MODE_SCENARIOS, selectScenario } from '@/lib/core/scenario-selector';
import { getEnginePreferencesByUserId } from '@/actions/update-user-settings';

const log = createLogger('actions:get-next-drill');

/** Seed 预加载的精简类型（避免 any 泛滥） */
interface QuestionSeedLite {
    id: string;
    sentence: string;
    targetAnswer: string;
    options: { text: string; isCorrect: boolean }[];
    questionType: string;
    rationale: string;
    part: number;
    usedCount: number;
}

// 辅助: 从 reviewData 构建客户端 FSRS 预览元数据
function buildFsrsCardMeta(reviewData: any) {
    if (!reviewData) return undefined;
    return {
        stability: reviewData.stability || 0,
        difficulty: reviewData.difficulty || 0,
        reps: reviewData.reps || 0,
        lapses: reviewData.lapses || 0,
        state: reviewData.state || 0,
        lastReview: reviewData.last_review_at?.toISOString?.(),
    };
}

// --- Main Action ---
export async function getNextDrillBatch(
    input: GetBriefingInput
): Promise<ActionState<BriefingPayload[]>> {
    try {
        // 1. 验证输入
        const validated = GetBriefingSchema.parse(input);
        const { userId, mode, limit: inputLimit, excludeVocabIds, grammarNodeId } = validated;

        // 读取用户引擎调度偏好 (跳过重复 auth，直接用已验证的 userId)
        const enginePrefs = await getEnginePreferencesByUserId(userId);
        const limit = inputLimit || 10;
        const reviewRatio = enginePrefs?.review_ratio; // 向下透传到 fetchOMPSCandidates

        log.info({ userId, mode, limit, enginePrefs, grammarNodeId }, 'Fetching drill batch (OMPS V1.1)');

        // ============================================
        // [Quick Drill] 靶向语法训练旁路
        // 当传入 grammarNodeId 时，100% 从该节点的 QuestionSeed 中抽题
        // 完全绕过 OMPS 词汇管道，直接使用原题
        // ============================================
        if (grammarNodeId && mode === 'ARENA_PART5') {
            log.info({ grammarNodeId, limit }, '🎯 Quick Drill: 靶向语法训练模式');

            // 1. 查询该 L3 节点下的 QuestionSeed（排除最近做过的题）
            const recentAttemptSeedIds = await prisma.attemptRecord.findMany({
                where: {
                    userId,
                    questionSeedId: { not: { equals: undefined } },
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24h 内
                },
                select: { questionSeedId: true }
            });
            const excludeSeedIds = recentAttemptSeedIds
                .map(a => a.questionSeedId)
                .filter((id): id is string => id !== null);

            const seeds = await prisma.questionSeed.findMany({
                where: {
                    grammarNodeId,
                    part: 5,
                    ...(excludeSeedIds.length > 0 ? { id: { notIn: excludeSeedIds } } : {})
                },
                orderBy: { usedCount: 'asc' },
                take: limit * 2 // 多取一些用于随机
            });

            // 随机打散后截取
            const selected = seeds.sort(() => 0.5 - Math.random()).slice(0, limit);

            if (selected.length === 0) {
                log.warn({ grammarNodeId }, '⚠️ Quick Drill: 该语法节点无可用题目');
                return { status: 'success', message: 'No seeds found for grammar node', data: [] };
            }

            // 2. 将 QuestionSeed 转化为 BriefingPayload（复用现有 fallback 模式）
            const drills: BriefingPayload[] = selected.map(seed => {
                const options = seed.options as { text: string; isCorrect: boolean }[];
                const answerKey = options?.find(o => o.isCorrect)?.text || seed.targetAnswer;

                return {
                    meta: {
                        format: 'chat' as any,
                        mode: 'ARENA_PART5' as any,
                        batch_size: 1,
                        sys_prompt_version: 'quick-drill-v1',
                        vocabId: 0, // 无锚点词汇
                        target_word: seed.targetAnswer,
                        source: 'quick_drill_seed',
                        questionSeedId: seed.id,
                        questionType: seed.questionType,
                        part: seed.part || 5
                    },
                    segments: [
                        {
                            type: 'text' as const,
                            content_markdown: String(seed.sentence).includes('_')
                                ? String(seed.sentence).replace(/_+/g, answerKey)
                                : String(seed.sentence),
                        },
                        {
                            type: 'interaction' as const,
                            dimension: 'V',
                            task: {
                                style: 'swipe_card' as const,
                                question_markdown: String(seed.sentence).includes('_')
                                    ? String(seed.sentence)
                                    : String(seed.sentence).replace(new RegExp(`\\b${answerKey}\\b`, 'i'), '_______'),
                                options: options?.map(o => o.text) || [answerKey],
                                answer_key: answerKey,
                                explanation_markdown: seed.rationale || '正确选项符合该句的语法及语境要求。'
                            }
                        }
                    ]
                };
            });

            // 异步回写 usedCount
            prisma.questionSeed.updateMany({
                where: { id: { in: selected.map(s => s.id) } },
                data: { usedCount: { increment: 1 } }
            }).catch(err => {
                log.warn({ err: err.message }, 'Failed to increment usedCount for quick drill seeds');
            });

            log.info({ grammarNodeId, count: drills.length }, '✅ Quick Drill: 靶向题目生成完成');
            return { status: 'success', message: `Quick Drill: ${drills.length} seeds`, data: drills.map(shuffleBriefingOptions) };
        }

        // 1.5 混合模式路由
        if (isMixedMode(mode)) {
            return getMixedDrillBatch(userId, mode, limit, excludeVocabIds, reviewRatio);
        }

        // 2. 通过 OMPS 获取候选词
        // 配置词性过滤 (SYNTAX 模式需要动词/名词)
        let posFilter: string[] | undefined;
        if (mode === 'SYNTAX') {
            posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞'];
        }

        const candidates = await fetchOMPSCandidates(
            userId,
            limit,
            {
                posFilter,
                ...(reviewRatio !== undefined ? { reviewRatio } : {})
            },
            excludeVocabIds,
            mode  // 传入 mode 启用库存优先策略
        );

        if (candidates.length === 0) {
            return {
                status: 'success',
                message: 'No candidates found',
                data: [],
            };
        }

        // 3.1 预取缓存并处理 N+1
        const vocabIds = candidates.map(c => c.vocabId);
        let drillMap: Record<number, BriefingPayload> = {};
        try {
            drillMap = await inventory.popDrillBatch(userId, { [mode]: vocabIds });
        } catch (e) {
            log.error({ error: e }, 'Redis batch pop failed in single mode');
        }

        // 3.1.5 ARENA 批量预加载 Seed 解决 N+1（精确匹配 + 随机兜底）
        let arenaSeedsMap: Record<string, QuestionSeedLite> = {};
        if (mode === 'ARENA_PART5') {
            const missingVocabs = candidates.filter(c => !drillMap[c.vocabId]).map(c => c.word);
            arenaSeedsMap = await preloadArenaSeeds(missingVocabs);
        }

        // 3.2 将候选词转换为 Drill (消费层)
        const drills: BriefingPayload[] = [];
        const missedVocabIds: number[] = [];

        for (const candidate of candidates) {
            let drill = drillMap[candidate.vocabId] || null;
            let source = 'unknown';

            if (drill) {
                source = 'cache_v2';
                auditInventoryEvent(userId, 'CONSUME', mode, {
                    currentCount: 0,
                    capacity: 0,
                    delta: -1,
                    vocabId: candidate.vocabId
                });
            } else {
                // 3.3 缓存未命中 -> 确定性兜底
                if (mode === 'CHUNKING') {
                    drill = buildChunkingDrillFallback({
                        id: candidate.vocabId,
                        word: candidate.word,
                        definition_cn: candidate.definition_cn,
                        definitions: candidate.definitions,
                        commonExample: candidate.commonExample,
                        phoneticUk: candidate.phoneticUk,
                        partOfSpeech: candidate.partOfSpeech,
                        etymology: candidate.etymology,
                        collocations: candidate.collocations
                    });
                } else if (mode === 'ARENA_PART5') {
                    drill = buildArenaFallbackDrill({
                        id: candidate.vocabId,
                        word: candidate.word,
                        definition_cn: candidate.definition_cn,
                        definitions: candidate.definitions,
                        commonExample: candidate.commonExample,
                        phoneticUk: candidate.phoneticUk,
                        partOfSpeech: candidate.partOfSpeech,
                        etymology: candidate.etymology,
                        collocations: candidate.collocations
                    }, mode, arenaSeedsMap[candidate.word]);
                } else {
                    drill = buildPhraseFallbackDrill({
                        id: candidate.vocabId,
                        word: candidate.word,
                        definition_cn: candidate.definition_cn,
                        definitions: candidate.definitions,
                        commonExample: candidate.commonExample,
                        phoneticUk: candidate.phoneticUk,
                        partOfSpeech: candidate.partOfSpeech,
                        etymology: candidate.etymology,
                        collocations: candidate.collocations
                    }, mode);
                }
                source = 'deterministic_fallback';
                missedVocabIds.push(candidate.vocabId);

                // [Audit] Record cache miss fallback
                auditSessionFallback(userId, mode, candidate.vocabId, candidate.word);
            }

            // 添加元数据
            if (drill) {
                drill.meta = {
                    ...drill.meta,
                    source,
                    vocabId: candidate.vocabId,
                    fsrsCard: buildFsrsCardMeta(candidate.reviewData),
                    userNote: candidate.userNote, // [New] Feature A
                };
                drills.push(drill);
            }
        }

        // 触发缓存补货
        if (missedVocabIds.length > 0) {
            inventory.triggerBatchEmergency(userId, mode, missedVocabIds).catch(err => {
                log.warn({ error: err.message }, 'Batch Emergency trigger failed');
            });
        }

        // 统计缓存命中率
        const cacheHitCount = drills.filter(d => (d.meta as any).source === 'cache_v2').length;
        const fastPathCount = drills.filter(d => (d.meta as any).source === 'fast_path_db').length;
        const fallbackCount = drills.filter(d => (d.meta as any).source === 'deterministic_fallback').length;
        const hitRate = drills.length > 0 ? ((cacheHitCount / drills.length) * 100).toFixed(1) : '0';

        log.info({
            userId,
            mode,
            total: drills.length,
            cacheHit: cacheHitCount,
            fastPath: fastPathCount,
            fallback: fallbackCount,
            hitRate: `${hitRate}%`
        }, '📊 Drill batch stats');

        if (drills.length > 0) {
            const preview = drills[0];
            // 使用类型守卫安全访问 InteractionSegment
            const interaction = preview.segments.find((s): s is import('@/types/briefing').InteractionSegment => s.type === 'interaction');
            log.info({
                firstDrillWord: preview.meta.target_word || 'unknown',
                source: (preview.meta as any).source,
                question: interaction?.task?.question_markdown || 'N/A'
            }, '👀 Drill Content Preview');
        }

        // 异步回写 usedCount（兜底时抽取的原题，用过就要打乱）
        const usedSeedIds = drills.flatMap(d => {
            const m = d.meta as any;
            return (m?.source === 'deterministic_fallback' && m?.questionSeedId && typeof m.questionSeedId === 'string' && !m.questionSeedId.startsWith('fallback'))
                ? [m.questionSeedId]
                : [];
        });

        if (usedSeedIds.length > 0) {
            prisma.questionSeed.updateMany({
                where: { id: { in: usedSeedIds } },
                data: { usedCount: { increment: 1 } }
            }).catch(err => {
                log.warn({ err: err.message }, 'Failed to increment usedCount for fallback seeds');
            });
        }

        return {
            status: 'success',
            message: `Batch retrieved (Cache Hit: ${hitRate}%)`,
            data: drills.map(shuffleBriefingOptions),
            meta: { count: drills.length, hitRate }
        };

    } catch (error: any) {
        log.error({ error }, 'getNextDrillBatch failed');
        return {
            status: 'error',
            message: error.message || 'Failed to generate drill batch',
            fieldErrors: {},
        };
    }
}

/**
 * 混合模式 Drill 获取
 * 为每个候选词根据 FSRS Stability 选择场景，然后从对应 Inventory 获取 Drill
 */
async function getMixedDrillBatch(
    userId: string,
    mixedMode: SessionMode,
    limit: number,
    excludeVocabIds: number[] = [],
    reviewRatio?: number
): Promise<ActionState<BriefingPayload[]>> {
    const allowedScenarios = MIXED_MODE_SCENARIOS[mixedMode];
    if (!allowedScenarios || allowedScenarios.length === 0) {
        return {
            status: 'error',
            message: `Unknown or empty mixed mode: ${mixedMode}`,
        };
    }

    log.info({ userId, mixedMode, allowedScenarios }, '🎭 Mixed mode routing');

    // 🔧 修复B2: 根据混合模式确定主 Track（保持 Multi-Track FSRS 隔离）
    const primaryTrack =
        mixedMode === 'L0_MIXED' || mixedMode === 'DAILY_BLITZ' ? 'VISUAL' :
            mixedMode === 'L1_MIXED' ? 'AUDIO' :
                mixedMode === 'L2_MIXED' ? 'CONTEXT' :
                    'VISUAL'; // 兜底

    // 1. 获取候选词（使用正确的 Track）
    const candidates = await fetchOMPSCandidates(
        userId,
        limit,
        {
            ...(reviewRatio !== undefined ? { reviewRatio } : {})
        },
        excludeVocabIds,
        primaryTrack  // ✅ 使用动态 Track 而不是硬编码 VISUAL
    );

    if (candidates.length === 0) {
        return {
            status: 'success',
            message: 'No candidates found for mixed mode',
            data: [],
        };
    }

    // 2. 预先分配场景
    const vocabScenarioMap = new Map<number, SingleScenarioMode>();
    const scenarioGroups: Record<string, number[]> = {};
    const scenarioDistribution: Record<string, number> = {};

    for (const candidate of candidates) {
        const stability = candidate.reviewData?.stability || 0;
        const selectedScenario = selectScenario(stability, allowedScenarios);

        vocabScenarioMap.set(candidate.vocabId, selectedScenario);
        scenarioDistribution[selectedScenario] = (scenarioDistribution[selectedScenario] || 0) + 1;

        if (!scenarioGroups[selectedScenario]) {
            scenarioGroups[selectedScenario] = [];
        }
        scenarioGroups[selectedScenario].push(candidate.vocabId);
    }

    // 3. 批量查询 Inventory (解决 N+1 问题)
    // 🔧 P1 优化: 使用 popDrillBatch 替代循环查询
    let drillMap: Record<number, BriefingPayload> = {};
    try {
        drillMap = await inventory.popDrillBatch(userId, scenarioGroups);
    } catch (e) {
        // 🔧 P1 优化: 数据库故障降级处理
        log.error({ error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined }, 'Inventory batch fetch failed');
        // 继续执行，所有词汇将回退到 fallback
    }

    // 3.5 ARENA 批量预加载 Seed 解决 N+1（精确匹配 + 随机兜底）
    const missingArenaVocabs = candidates
        .filter(c => vocabScenarioMap.get(c.vocabId) === 'ARENA_PART5' && !drillMap[c.vocabId])
        .map(c => c.word);
    const arenaSeedsMap = await preloadArenaSeeds(missingArenaVocabs);

    // 4. 组装结果（Cache Hit 或 Fallback）
    const drills: BriefingPayload[] = [];
    const missingCandidates: { candidate: typeof candidates[0], scenario: string }[] = [];

    for (const candidate of candidates) {
        const selectedScenario = vocabScenarioMap.get(candidate.vocabId)!;
        let drill = drillMap[candidate.vocabId];
        let source = 'unknown';

        if (drill) {
            source = 'cache_v2';
            auditInventoryEvent(userId, 'CONSUME', selectedScenario, {
                currentCount: 0,
                capacity: 0,
                delta: -1,
                vocabId: candidate.vocabId
            });
        } else {
            // Cache Miss -> Deterministic Fallback
            // 🔧 修复W5: 兜底策略文档
            // 降级策略：当 Inventory 为空时，使用模板生成基础 Drill
            // 目的：保证 Zero-Wait 体验，避免用户等待 LLM 生成
            // 策略：使用 buildPhraseFallbackDrill 或专用构建器生成确定性内容（基于词汇本身的属性）
            if (selectedScenario === 'CHUNKING') {
                drill = buildChunkingDrillFallback({
                    id: candidate.vocabId,
                    word: candidate.word,
                    definition_cn: candidate.definition_cn,
                    definitions: candidate.definitions,
                    commonExample: candidate.commonExample,
                    phoneticUk: candidate.phoneticUk,
                    partOfSpeech: candidate.partOfSpeech,
                    etymology: candidate.etymology,
                    collocations: candidate.collocations
                });
            } else if (selectedScenario === 'ARENA_PART5') {
                drill = buildArenaFallbackDrill({
                    id: candidate.vocabId,
                    word: candidate.word,
                    definition_cn: candidate.definition_cn,
                    definitions: candidate.definitions,
                    commonExample: candidate.commonExample,
                    phoneticUk: candidate.phoneticUk,
                    partOfSpeech: candidate.partOfSpeech,
                    etymology: candidate.etymology,
                    collocations: candidate.collocations
                }, selectedScenario, arenaSeedsMap[candidate.word]);
            } else {
                drill = buildPhraseFallbackDrill({
                    id: candidate.vocabId,
                    word: candidate.word,
                    definition_cn: candidate.definition_cn,
                    definitions: candidate.definitions,
                    commonExample: candidate.commonExample,
                    phoneticUk: candidate.phoneticUk,
                    partOfSpeech: candidate.partOfSpeech,
                    etymology: candidate.etymology,
                    collocations: candidate.collocations
                }, selectedScenario);
            }
            source = 'deterministic_fallback';

            // 收集缺货词汇，稍后批量触发急救
            missingCandidates.push({ candidate, scenario: selectedScenario });

            auditSessionFallback(userId, selectedScenario, candidate.vocabId, candidate.word);
        }

        if (drill) {
            drill.meta = {
                ...drill.meta,
                mode: selectedScenario,
                source,
                vocabId: candidate.vocabId,
                stability: candidate.reviewData?.stability || 0, // ✅ BLOCKER-02 修复: 传递 Stability 用于日志统计
                fsrsCard: buildFsrsCardMeta(candidate.reviewData),
                userNote: candidate.userNote, // [New] Feature A
            };
            drills.push(drill);
        }
    }

    // 5. 触发批量急救 (异步非阻塞)
    if (missingCandidates.length > 0) {
        // 按场景分组触发批量急救
        const missingByScenario: Record<string, number[]> = {};
        for (const item of missingCandidates) {
            if (!missingByScenario[item.scenario]) missingByScenario[item.scenario] = [];
            missingByScenario[item.scenario].push(item.candidate.vocabId);
        }

        for (const [scenario, vids] of Object.entries(missingByScenario)) {
            inventory.triggerBatchEmergency(userId, scenario, vids).catch(err => {
                log.warn({ error: err.message, scenario }, 'Batch emergency trigger failed');
            });
        }
    }

    log.info({
        userId,
        mixedMode,
        total: drills.length,
        scenarioDistribution,
        // 🔧 修复W2: 添加 Stability 范围统计
        stabilityRange: drills.length > 0 ? {
            min: Math.min(...drills.map(d => {
                const meta = d.meta as any;
                return meta.stability || 0;
            })),
            max: Math.max(...drills.map(d => {
                const meta = d.meta as any;
                return meta.stability || 0;
            })),
            avg: (drills.reduce((sum, d) => {
                const meta = d.meta as any;
                return sum + (meta.stability || 0);
            }, 0) / drills.length).toFixed(2)
        } : null
    }, '🎭 Mixed mode drill distribution');

    // ✅ BLOCKER-01 修复: 调用监控函数持久化数据
    if (drills.length > 0) {
        auditMixedModeDistribution(userId, mixedMode, {
            distribution: scenarioDistribution,
            totalDrills: drills.length,
            stabilityStats: {
                min: Math.min(...candidates.map(c => c.reviewData?.stability || 0)),
                max: Math.max(...candidates.map(c => c.reviewData?.stability || 0)),
                avg: parseFloat((candidates.reduce((sum, c) => sum + (c.reviewData?.stability || 0), 0) / candidates.length).toFixed(2))
            }
        });
    }

    // 异步回写 usedCount（兜底时抽取的原题，用过就要打乱）
    const usedSeedIds = drills.flatMap(d => {
        const m = d.meta as any;
        return (m?.source === 'deterministic_fallback' && m?.questionSeedId && typeof m.questionSeedId === 'string' && !m.questionSeedId.startsWith('fallback'))
            ? [m.questionSeedId]
            : [];
    });

    if (usedSeedIds.length > 0) {
        prisma.questionSeed.updateMany({
            where: { id: { in: usedSeedIds } },
            data: { usedCount: { increment: 1 } }
        }).catch(err => {
            log.warn({ err: err.message }, 'Failed to increment usedCount for mixed mode fallback seeds');
        });
    }

    return {
        status: 'success',
        message: `Mixed mode (${mixedMode}) drills fetched`,
        data: drills.map(shuffleBriefingOptions),
    };
}

/**
 * ARENA Seed 批量预加载（精确匹配 + 随机兜底）
 * 
 * 功能：
 *   统一处理单模式和混合模式两条路径的 seed 预加载逻辑。
 *   1. 先通过 targetAnswer 精确匹配 QuestionSeed
 *   2. 未匹配到的词汇，获取随机 QuestionSeed 作为结构模板
 *   确保 buildArenaFallbackDrill 始终能收到 seed，避免退化为极端兜底。
 */
async function preloadArenaSeeds(
    missingWords: string[]
): Promise<Record<string, QuestionSeedLite>> {
    const seedsMap: Record<string, QuestionSeedLite> = {};
    if (missingWords.length === 0) return seedsMap;

    // Step 1: 精确匹配 targetAnswer
    const exactSeeds = await prisma.questionSeed.findMany({
        where: { targetAnswer: { in: missingWords } },
        orderBy: { id: 'asc' }
    });
    for (const seed of exactSeeds) {
        if (!seedsMap[seed.targetAnswer]) {
            seedsMap[seed.targetAnswer] = seed as unknown as QuestionSeedLite;
        }
    }

    // Step 2: 为未匹配的词汇获取随机 seed 作为结构模板
    const unmatchedWords = missingWords.filter(w => !seedsMap[w]);
    if (unmatchedWords.length > 0) {
        const randomSeeds = await prisma.questionSeed.findMany({
            where: { part: 5 },
            orderBy: { usedCount: 'asc' },       // 优先最少使用（单次查询代替 count+findMany）
            take: unmatchedWords.length * 2        // 取多一些用于随机选择
        });

        // 随机打散后分配
        const shuffled = randomSeeds.sort(() => 0.5 - Math.random());
        shuffled.forEach((seed, idx) => {
            if (idx < unmatchedWords.length) {
                seedsMap[unmatchedWords[idx]] = seed as unknown as QuestionSeedLite;
            }
        });

        log.info({
            exact: exactSeeds.length,
            random: Math.min(shuffled.length, unmatchedWords.length),
            total: missingWords.length
        }, '🎯 Arena Seed preload (exact + random fallback)');
    }

    return seedsMap;
}
