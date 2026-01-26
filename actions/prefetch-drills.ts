'use server';

import { auth } from '@/auth';
import { checkCacheStatus, saveDrillToCache } from '@/lib/drill-cache';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { SessionMode } from '@/types/briefing';
import { createLogger } from '@/lib/logger';

const log = createLogger('actions:prefetch');

const MODES_TO_PREFETCH: SessionMode[] = ['SYNTAX', 'CHUNKING', 'NUANCE'];
const CACHE_THRESHOLD = 4;

/**
 * 快速检查缓存状态（非阻塞版本）
 * 只检查状态，不做实际生成
 * 实际生成由 Cron Job 或 triggerSinglePrefetch 完成
 */
export async function prefetchDrills() {
    const session = await auth();
    if (!session?.user?.id) return { status: 'skip', reason: 'no session' };

    const userId = session.user.id;
    const results: { mode: SessionMode; status: string }[] = [];

    // 只做快速检查，不阻塞
    for (const mode of MODES_TO_PREFETCH) {
        try {
            const needsRefill = await checkCacheStatus(userId, mode, CACHE_THRESHOLD);
            results.push({ mode, status: needsRefill ? 'low' : 'ok' });
        } catch (e: any) {
            if (e.code === 'P2003') {
                log.warn({ userId }, 'Prefetch check skipped: stale session');
                return { status: 'error', reason: 'stale session' };
            }
            results.push({ mode, status: 'error' });
        }
    }

    // 找到第一个需要补充的模式，触发后台生成（但不等待）
    const lowMode = results.find(r => r.status === 'low');
    if (lowMode) {
        log.info({ userId, mode: lowMode.mode }, 'Cache low detected, triggering background generation');
        // Fire and forget - 启动生成但不等待
        triggerBackgroundGeneration(userId, lowMode.mode).catch(() => { });
    }

    return { status: 'success', results };
}

/**
 * 后台生成（不阻塞调用者）
 * 这个函数会自己完成生成和保存
 */
async function triggerBackgroundGeneration(userId: string, mode: SessionMode) {
    const sizeMap: Record<SessionMode, number> = {
        'SYNTAX': 20,
        'CHUNKING': 30,
        'NUANCE': 50,
        'BLITZ': 10,
        'PHRASE': 20,
        'AUDIO': 20,
        'READING': 20,
        'VISUAL': 20
    };

    try {
        log.info({ userId, mode }, 'Background generation started');

        const result = await getNextDrillBatch({
            userId,
            mode,
            limit: sizeMap[mode],
            forceRefresh: true,
        });

        if (result.status === 'success' && result.data) {
            await saveDrillToCache(userId, mode, result.data);
            log.info({ userId, mode }, 'Background generation completed and saved');
        }
    } catch (e: any) {
        log.error({ userId, mode, err: e.message }, 'Background generation failed');
    }
}
