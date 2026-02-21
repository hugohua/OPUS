import { db } from '@/lib/db';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { addDays } from 'date-fns';

/**
 * 查找可用的缓存 Drill
 * Find a valid, unconsumed drill cache for the user and mode.
 */
export async function findCachedDrill(userId: string, mode: string) {
    return db.drillCache.findFirst({
        where: {
            userId,
            mode,
            isConsumed: false,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' }, // FIFO: use oldest reliable cache first
    });
}

/**
 * 标记缓存为已消费
 */
export async function markDrillConsumed(id: string) {
    return db.drillCache.update({
        where: { id },
        data: { isConsumed: true },
    });
}

/**
 * 保存生成的 Drill 到缓存
 */
export async function saveDrillToCache(
    userId: string,
    mode: string,
    payload: BriefingPayload[]
) {
    return db.drillCache.create({
        data: {
            userId,
            mode,
            payload: payload as any, // Json type casting
            expiresAt: addDays(new Date(), 1),
            isConsumed: false,
        }
    });
}

/**
 * 检查缓存状态
 * Returns true if cache needs replenishment (count < threshold)
 */
export async function checkCacheStatus(userId: string, mode: string, threshold = 1) {
    const count = await db.drillCache.count({
        where: {
            userId,
            mode,
            isConsumed: false,
            expiresAt: { gt: new Date() },
        }
    });
    return count < threshold;
}

/**
 * 获取缓存数量
 */
export async function getCacheCount(userId: string, mode: string) {
    return db.drillCache.count({
        where: {
            userId,
            mode,
            isConsumed: false,
            expiresAt: { gt: new Date() },
        }
    });
}

/**
 * 缓存上限配置（测试友好配置：Limit = 批次数）
 * 1 批 = 5 题
 */
/**
 * 缓存上限配置 (Single Source of Truth)
 * Keys: SessionMode
 * Values: Max Batch Count (1 Batch = 5 Drills)
 * Example: SYNTAX: 5 => 25 Drills Max
 */
export const DRILLS_PER_BATCH = 5;

import { createSessionModeRecord } from '@/lib/config/mixed-mode-config';

export const CACHE_LIMIT_MAP = createSessionModeRecord({
    SYNTAX: 10,      // 50 drills (10 * 5)
    CHUNKING: 10,    // 50 drills
    NUANCE: 6,      // 30 drills (6 * 5)
    BLITZ: 6,       // 30 drills
    PHRASE: 10,      // 50 drills
    AUDIO: 10,       // 50 drills
    READING: 10,     // 50 drills
    VISUAL: 10,      // 50 drills
    CONTEXT: 6,      // [L2] 30 drills
    ARENA_PART5: 6   // [L2] 30 drills
});
