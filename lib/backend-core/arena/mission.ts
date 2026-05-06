import { inventory } from "@/lib/core/inventory";
import { shuffleBriefingOptions } from "@/lib/core/shuffle-options";
import { logger } from "@/lib/logger";
import { fetchOMPSCandidates } from "@/lib/services/omps-core";
import { auditInventoryEvent, auditSessionFallback } from "@/lib/services/audit-service";
import { buildArenaPart6FallbackDrill } from "@/lib/templates/arena-fallback";
import { type BriefingPayload } from "@/types/briefing";

const log = logger.child({ module: "arena-mission-core" });

export async function generateArenaMissionForUser(userId: string): Promise<BriefingPayload> {
    const mode = "ARENA_PART6";

    try {
        const candidates = await fetchOMPSCandidates(userId, 1, {}, [], mode);
        if (!candidates || candidates.length === 0) {
            log.warn({ userId }, "OMPS failed to return a target word for Part 6");
            return buildArenaPart6FallbackDrill("system_error");
        }

        const candidate = candidates[0];
        const vocabIds = [candidate.vocabId];
        let drillMap: Record<number, BriefingPayload> = {};

        try {
            drillMap = await inventory.popDrillBatch(userId, { [mode]: vocabIds });
        } catch (error) {
            log.error({ error }, `Redis batch pop failed in single mode: ${mode}`);
        }

        let drill = drillMap[candidate.vocabId] || null;
        let source = "unknown";

        if (drill) {
            source = "cache_v2";
            auditInventoryEvent(userId, "CONSUME", mode, {
                currentCount: 0,
                capacity: 0,
                delta: -1,
                vocabId: candidate.vocabId,
            });
            log.info({ userId, vocabId: candidate.vocabId }, "O(1) cached Part 6 drill consumed");
        } else {
            log.warn({ userId, vocabId: candidate.vocabId }, "Part 6 cache miss, using deterministic fallback");
            drill = await buildArenaPart6FallbackDrill(candidate.word);
            source = "deterministic_fallback";
            auditSessionFallback(userId, mode, candidate.vocabId, candidate.word);
            inventory.triggerBatchEmergency(userId, mode, [candidate.vocabId]).catch((error) => {
                log.warn({ error: error.message }, "Batch emergency trigger failed for Part 6");
            });
        }

        drill.meta = {
            ...drill.meta,
            source,
            vocabId: candidate.vocabId,
        };

        return shuffleBriefingOptions(drill);
    } catch (error) {
        log.error({ error: (error as Error).message }, "Part 6 mission generation failed");
        return buildArenaPart6FallbackDrill("system_error");
    }
}
