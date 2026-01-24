'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { checkCacheStatus, saveDrillToCache } from '@/lib/drill-cache';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { createLogger } from '@/lib/logger';

const log = createLogger('actions:prefetch');

const MODES_TO_PREFETCH: SessionMode[] = ['SYNTAX', 'CHUNKING', 'NUANCE'];

/**
 * Checks cache status for all modes and triggers generation if needed.
 * This is intended to be called by the client (SimulatePage) on mount.
 * 
 * NOTE: Since Vercel Serverless functions can't easily spawn detached background jobs,
 * we have to be careful not to block the client too long. 
 * HOWEVER, the goal here is to start the process. 
 * 
 * Current strategy: Check all. If any missing, generate the FIRST missing one and return.
 * The client can call this multiple times or we rely on the probability that user won't click THAT fast.
 */
export async function prefetchDrills() {
    const session = await auth();
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const results = [];

    // Check statuses
    for (const mode of MODES_TO_PREFETCH) {
        const needsRefill = await checkCacheStatus(userId, mode, 1); // Ensure at least 1

        if (needsRefill) {
            log.info({ userId, mode }, 'Prefetch triggered: Cache low');

            // We call getNextDrillBatch but explicitly force NO CACHE logic? 
            // Actually getNextDrillBatch consumes cache.
            // We need a way to GENERATE without consuming. 
            // OR we just use getNextDrillBatch's internal logic components.
            // A better way: Modify getNextDrillBatch to have a 'dryRun' or 'generateOnly'? 
            // Or just reimplement the generation call wrapper here?

            // Re-using logic: calling getNextDrillBatch with a small limit might bypass cache?
            // No, getNextDrillBatch(10 is threshold).

            // Let's rely on getNextDrillBatch to DO the work, but we need to intercept the result.
            // Wait, if I call getNextDrillBatch, it returns the payload. I can just save it!
            // But getNextDrillBatch checks cache first. If I call it, it might return a cached item (if >10).
            // But we know cache is LOW (<1). So it will generate.

            try {
                // Determine batch size based on mode
                const sizeMap: Record<SessionMode, number> = {
                    'SYNTAX': 20,
                    'CHUNKING': 30,
                    'NUANCE': 50
                };

                // Call generation (will effectively be a cache miss)
                const result = await getNextDrillBatch({
                    userId,
                    mode,
                    limit: sizeMap[mode],
                    forceRefresh: true,
                });

                if (result.status === 'success' && result.data) {
                    await saveDrillToCache(userId, mode, result.data);
                    log.info({ userId, mode }, 'Prefetch saved to cache');
                    results.push({ mode, status: 'filled' });
                }
            } catch (e) {
                log.error({ userId, mode, err: e }, 'Prefetch failed');
            }
        } else {
            results.push({ mode, status: 'ok' });
        }
    }

    return { status: 'success', results };
}
