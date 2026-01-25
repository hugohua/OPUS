/**
 * Session Settler Worker
 * 功能：
 *   定时扫描 active_sessions ZSet，结算不活跃用户的学习数据
 * 调度：
 *   每分钟执行一次 (CRON: * * * * *)
 * 逻辑：
 *   1. 从 active_sessions 找出 5 分钟无活动的用户
 *   2. 调用 flushUserSession 结算
 */

import { redis } from '@/lib/queue/connection';
import { flushUserSession } from '@/lib/session-manager';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'session-settler' });

// 不活跃阈值 (毫秒)
const INACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 分钟

/**
 * 获取不活跃用户列表
 */
export async function getInactiveUsers(): Promise<string[]> {
    const now = Date.now();
    const cutoff = now - INACTIVE_THRESHOLD_MS;

    // ZRANGEBYSCORE: 获取 score (最后活跃时间) 小于 cutoff 的用户
    const users = await redis.zrangebyscore('active_sessions', 0, cutoff);

    return users;
}

/**
 * 结算所有不活跃用户
 */
export async function settleInactiveUsers(): Promise<number> {
    const users = await getInactiveUsers();

    if (users.length === 0) {
        log.debug('No inactive users to settle');
        return 0;
    }

    log.info({ count: users.length }, 'Found inactive users, starting settlement');

    let settled = 0;
    for (const userId of users) {
        try {
            await flushUserSession(userId);
            settled++;
        } catch (err: any) {
            log.error({ userId, error: err.message }, 'Failed to settle user session');
        }
    }

    log.info({ settled, total: users.length }, 'Settlement complete');
    return settled;
}

/**
 * Worker 入口 (被 index.ts 调用)
 */
export async function processSettlerJob(): Promise<{ settled: number }> {
    const settled = await settleInactiveUsers();
    return { settled };
}
