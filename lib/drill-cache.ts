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
 * 1 批 = 10 题
 */
/**
 * 缓存上限配置 (Single Source of Truth)
 * Keys: SessionMode
 * Values: Max Batch Count (1 Batch = 10 Drills)
 * Example: SYNTAX: 5 => 50 Drills Max
 */
export const DRILLS_PER_BATCH = 10;

export const CACHE_LIMIT_MAP: Record<SessionMode, number> = {
    SYNTAX: 5,      // 50 drills
    CHUNKING: 5,    // 50 drills
    NUANCE: 3,      // 30 drills
    BLITZ: 3,       // 30 drills
    PHRASE: 5,      // 50 drills
    AUDIO: 5,       // 50 drills
    READING: 5,     // 50 drills
    VISUAL: 5,      // 50 drills
};
