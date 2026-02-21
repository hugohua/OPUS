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
import { fetchOMPSCandidates, OMPSCandidate } from '@/lib/services/omps-core';
import { auditInventoryEvent, auditSessionFallback, auditMixedModeDistribution } from '@/lib/services/audit-service';

const log = createLogger('actions:get-next-drill');

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
        const { userId, mode, limit: inputLimit, excludeVocabIds } = validated;
        const limit = inputLimit || 10;

        log.info({ userId, mode, limit }, 'Fetching drill batch (OMPS V1.1)');

        // 1.5 混合模式路由
        const { isMixedMode } = await import('@/lib/core/scenario-selector');
        if (isMixedMode(mode)) {
            return getMixedDrillBatch(userId, mode, limit, excludeVocabIds);
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
            { posFilter },
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

        // 3.1.5 ARENA 批量预加载 Seed 解决 N+1
        let arenaSeedsMap: Record<string, any> = {};
        if (mode === 'ARENA_PART5') {
            const missingVocabs = candidates.filter(c => !drillMap[c.vocabId]).map(c => c.word);
            if (missingVocabs.length > 0) {
                const seeds = await prisma.questionSeed.findMany({
                    where: { targetAnswer: { in: missingVocabs } },
                    orderBy: { id: 'asc' }
                });
                for (const seed of seeds) {
                    if (!arenaSeedsMap[seed.targetAnswer]) {
                        arenaSeedsMap[seed.targetAnswer] = seed;
                    }
                }
            }
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

        return {
            status: 'success',
            message: `Batch retrieved (Cache Hit: ${hitRate}%)`,
            data: drills,
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
    excludeVocabIds: number[] = []
): Promise<ActionState<BriefingPayload[]>> {
    const { MIXED_MODE_SCENARIOS, selectScenario } = await import('@/lib/core/scenario-selector');

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
        {},
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

    // 3.5 ARENA 批量预加载 Seed 解决 N+1
    let arenaSeedsMap: Record<string, any> = {};
    const missingArenaVocabs = candidates
        .filter(c => vocabScenarioMap.get(c.vocabId) === 'ARENA_PART5' && !drillMap[c.vocabId])
        .map(c => c.word);

    if (missingArenaVocabs.length > 0) {
        const seeds = await prisma.questionSeed.findMany({
            where: { targetAnswer: { in: missingArenaVocabs } },
            orderBy: { id: 'asc' }
        });
        for (const seed of seeds) {
            if (!arenaSeedsMap[seed.targetAnswer]) {
                arenaSeedsMap[seed.targetAnswer] = seed;
            }
        }
    }

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

    return {
        status: 'success',
        message: `Mixed mode (${mixedMode}) drills fetched`,
        data: drills,
    };
}
