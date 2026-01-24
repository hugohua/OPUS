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
