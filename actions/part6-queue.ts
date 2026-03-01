"use server";

import { fetchOMPSCandidates } from "@/lib/services/omps-core";
import { BriefingPayload } from "@/types/briefing";
import { auth } from "@/auth";
import { inventory } from "@/lib/core/inventory";
import { buildArenaPart6FallbackDrill } from "@/lib/templates/arena-fallback";
import { auditInventoryEvent, auditSessionFallback } from "@/lib/services/audit-service";
import { logger } from "@/lib/logger";
import { shuffleBriefingOptions } from "@/lib/core/shuffle-options";

const log = logger.child({ module: 'part6-queue' });

/**
 * Part 6 Session 消费入口 (Server Action)
 * 鉴权后自动从 Session 获取 userId。
 * 从 V6 开始，这里改为了纯纯的消费者 O(1) 逻辑，绝不在此与大模型缠斗。
 */
export async function generatePart6Session(): Promise<BriefingPayload> {
    const session = await auth();
    if (!session?.user?.id) {
        log.warn("Unauthenticated attempt to generate Part 6 session");
        return buildArenaPart6FallbackDrill("authentication_failed");
    }
    const userId = session.user.id;
    const mode = 'ARENA_PART6';

    try {
        // 1. Fetch exactly 1 Target Word candidate via OMPS (to know what we WANT to drill)
        const candidates = await fetchOMPSCandidates(userId, 1, {}, [], mode);
        if (!candidates || candidates.length === 0) {
            log.warn({ userId }, "OMPS failed to return a target word for Part 6, triggering extreme fallback.");
            return buildArenaPart6FallbackDrill("system_error");
        }
        const candidate = candidates[0];

        // 2. O(1) 预取缓存并处理 N+1
        const vocabIds = [candidate.vocabId];
        let drillMap: Record<number, BriefingPayload> = {};
        try {
            drillMap = await inventory.popDrillBatch(userId, { [mode]: vocabIds });
        } catch (e) {
            log.error({ error: e }, `Redis batch pop failed in single mode: ${mode}`);
        }

        // 3. 提取预制件或进入兜底
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
            log.info({ userId, vocabId: candidate.vocabId }, `🚀 O(1) Cache Hit: Fetched pre-generated Part 6 drill`);
        } else {
            // [Mission Critical] Cache Miss -> 立即转为极致性能的安全硬兜底
            log.warn({ userId, vocabId: candidate.vocabId }, `⚠️ Cache Miss: Falling back to static template for Part 6`);
            drill = await buildArenaPart6FallbackDrill(candidate.word);
            source = 'deterministic_fallback';

            // 记录下降点并启动后方救火员队伍
            auditSessionFallback(userId, mode, candidate.vocabId, candidate.word);

            inventory.triggerBatchEmergency(userId, mode, [candidate.vocabId]).catch(err => {
                log.warn({ error: err.message }, 'Batch Emergency trigger failed for Part 6');
            });
        }

        // 追加最后的用户追踪印记
        drill.meta = {
            ...drill.meta,
            source,
            vocabId: candidate.vocabId
        };

        // 4. 水位探测 (Watermark Probing): 当存量被划走后，后台如果认为水位不够会自动调起 Bullmq Replenish 补货
        // Check triggers Replenish silently in background.
        // 注意：popDrillBatch 会自动触发 checkAndTriggerReplenish，所以此处通常不需要再手动触发

        return shuffleBriefingOptions(drill);

    } catch (error) {
        log.error({ error: (error as Error).message }, "[Part 6 Queue] End-to-end failure, firing Last Resort Fallback");
        return buildArenaPart6FallbackDrill("system_error");
    }
}
