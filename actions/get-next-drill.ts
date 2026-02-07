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
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { GetBriefingSchema, GetBriefingInput } from '@/lib/validations/briefing';
import { inventory } from '@/lib/core/inventory';
import { buildSimpleDrill } from '@/lib/templates/deterministic-drill';
import { fetchOMPSCandidates, OMPSCandidate } from '@/lib/services/omps-core';
import { auditSessionFallback, auditInventoryEvent } from '@/lib/services/audit-service';

const log = createLogger('actions:get-next-drill');

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

        // 3. 将候选词转换为 Drill (消费层)
        const drills: BriefingPayload[] = [];
        const missedVocabIds: number[] = [];

        for (const candidate of candidates) {
            let drill: BriefingPayload | null = null;
            let source = 'unknown';

            // 3.2 标准路径：Redis 缓存 (Unified Zero-Wait)
            try {
                // All modes (SYNTAX, PHRASE, BLITZ, AUDIO, etc.) try cache first
                drill = await inventory.popDrill(userId, mode, candidate.vocabId);
                if (drill) {
                    source = 'cache_v2';
                    // [Audit] 记录库存消费事件
                    auditInventoryEvent(userId, 'CONSUME', mode, {
                        currentCount: 0, // 消费时不单独查询库存
                        capacity: 0,
                        delta: -1,
                        vocabId: candidate.vocabId // W2 Fix: 记录消费的词汇 ID
                    });
                }
            } catch (e) {
                log.error({ error: e, candidate }, 'Redis pop failed');
            }

            // 3.3 缓存未命中 -> 确定性兜底
            if (!drill) {
                drill = buildSimpleDrill({
                    id: candidate.vocabId,
                    word: candidate.word,
                    definition_cn: candidate.definition_cn,
                    definitions: candidate.definitions, // [New]
                    commonExample: candidate.commonExample,
                    phoneticUk: candidate.phoneticUk, // [New]
                    partOfSpeech: candidate.partOfSpeech, // [New]
                    etymology: candidate.etymology, // [New]
                    collocations: candidate.collocations // Check collocations
                }, mode);
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
            const interaction = preview.segments.find((s: any) => s.type === 'interaction');
            log.info({
                firstDrillWord: preview.meta.target_word || 'unknown',
                source: (preview.meta as any).source,
                question: (interaction?.task as any)?.question_markdown || 'N/A'
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
