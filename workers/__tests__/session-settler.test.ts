import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('@/lib/queue/connection', () => ({
    redis: {
        zrangebyscore: vi.fn()
    }
}));

vi.mock('@/lib/session-manager', () => ({
    flushUserSession: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        })
    }
}));

import { getInactiveUsers, settleInactiveUsers, processSettlerJob } from '../session-settler';
import { redis } from '@/lib/queue/connection';
import { flushUserSession } from '@/lib/session-manager';

describe('session-settler Worker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getInactiveUsers', () => {
        it('应返回不活跃用户列表', async () => {
            (redis.zrangebyscore as any).mockResolvedValue(['user1', 'user2']);

            const users = await getInactiveUsers();

            expect(users).toEqual(['user1', 'user2']);
            expect(redis.zrangebyscore).toHaveBeenCalledWith(
                'active_sessions',
                0,
                expect.any(Number)
            );
        });
    });

    describe('settleInactiveUsers', () => {
        it('应结算所有不活跃用户', async () => {
            (redis.zrangebyscore as any).mockResolvedValue(['user1', 'user2']);
            (flushUserSession as any).mockResolvedValue(undefined);

            const settled = await settleInactiveUsers();

            expect(settled).toBe(2);
            expect(flushUserSession).toHaveBeenCalledTimes(2);
            expect(flushUserSession).toHaveBeenCalledWith('user1');
            expect(flushUserSession).toHaveBeenCalledWith('user2');
        });

        it('无不活跃用户时返回 0', async () => {
            (redis.zrangebyscore as any).mockResolvedValue([]);

            const settled = await settleInactiveUsers();

            expect(settled).toBe(0);
            expect(flushUserSession).not.toHaveBeenCalled();
        });

        it('单个用户失败不影响其他用户', async () => {
            (redis.zrangebyscore as any).mockResolvedValue(['user1', 'user2', 'user3']);
            (flushUserSession as any)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('DB Error'))
                .mockResolvedValueOnce(undefined);

            const settled = await settleInactiveUsers();

            expect(settled).toBe(2); // 2 成功, 1 失败
            expect(flushUserSession).toHaveBeenCalledTimes(3);
        });
    });

    describe('processSettlerJob', () => {
        it('应返回结算数量', async () => {
            (redis.zrangebyscore as any).mockResolvedValue(['user1']);
            (flushUserSession as any).mockResolvedValue(undefined);

            const result = await processSettlerJob();

            expect(result).toEqual({ settled: 1 });
        });
    });
});
