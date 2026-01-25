import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventory } from '../inventory';
import { redis as mockRedis } from '@/lib/queue/connection';
import { inventoryQueue } from '@/lib/queue';

// Mocks
vi.mock('@/lib/queue/connection', () => ({
    redis: {
        pipeline: vi.fn(),
        multi: vi.fn(),
        hincrby: vi.fn(),
        llen: vi.fn(),
        sadd: vi.fn(),
        scard: vi.fn(),
        spop: vi.fn(),
        hgetall: vi.fn(),
    }
}));

vi.mock('@/lib/queue', () => ({
    inventoryQueue: {
        add: vi.fn()
    }
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn()
    })
}));

describe('inventory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('pushDrill', () => {
        it('should push drill to redis using pipeline', async () => {
            const pipelineMock = {
                rpush: vi.fn(),
                hincrby: vi.fn(),
                exec: vi.fn().mockResolvedValue([])
            };
            (mockRedis.pipeline as any).mockReturnValue(pipelineMock);

            await inventory.pushDrill('user1', 'SYNTAX', 123, { some: 'drill' } as any);

            expect(mockRedis.pipeline).toHaveBeenCalled();
            expect(pipelineMock.rpush).toHaveBeenCalledWith(
                'user:user1:mode:SYNTAX:vocab:123:drills',
                JSON.stringify({ some: 'drill' })
            );
            expect(pipelineMock.hincrby).toHaveBeenCalledWith(
                'user:user1:inventory:stats',
                'SYNTAX',
                1
            );
            expect(pipelineMock.exec).toHaveBeenCalled();
        });
    });

    describe('popDrill', () => {
        it('should pop drill and decrement stats if exists', async () => {
            const mockDrill = { some: 'drill' };
            const multiMock = {
                lpop: vi.fn().mockReturnThis(),
                exec: vi.fn().mockResolvedValue([[null, JSON.stringify(mockDrill)]])
            };
            (mockRedis.multi as any).mockReturnValue(multiMock);

            // Mock replenish check (high inventory)
            (mockRedis.llen as any).mockResolvedValue(10);

            const result = await inventory.popDrill('user1', 'SYNTAX', 123);

            expect(result).toEqual(mockDrill);
            expect(mockRedis.hincrby).toHaveBeenCalledWith(
                'user:user1:inventory:stats',
                'SYNTAX',
                -1
            );
        });

        it('should return null if queue is empty', async () => {
            const multiMock = {
                lpop: vi.fn().mockReturnThis(),
                exec: vi.fn().mockResolvedValue([[null, null]])
            };
            (mockRedis.multi as any).mockReturnValue(multiMock);
            (mockRedis.llen as any).mockResolvedValue(0);

            const result = await inventory.popDrill('user1', 'SYNTAX', 123);
            expect(result).toBeNull();
        });

        it('should trigger replenish if inventory low', async () => {
            const multiMock = {
                lpop: vi.fn().mockReturnThis(),
                exec: vi.fn().mockResolvedValue([[null, JSON.stringify({})]])
            };
            (mockRedis.multi as any).mockReturnValue(multiMock);

            // Low inventory
            (mockRedis.llen as any).mockResolvedValue(1);
            // Buffer counts (below flush threshold)
            (mockRedis.scard as any).mockResolvedValue(2);

            await inventory.popDrill('user1', 'SYNTAX', 123);

            // Wait a tick for async check
            await new Promise(process.nextTick);

            expect(mockRedis.sadd).toHaveBeenCalledWith(
                'buffer:replenish_drills',
                'user1:SYNTAX:123'
            );
        });
    });

    describe('Replenishment Logic (Buffer & Flush)', () => {
        it('checkBufferAndFlush should flush if threshold reached', async () => {
            (mockRedis.scard as any).mockResolvedValue(5);
            // Mock spop returning items
            const items = [
                'user1:SYNTAX:101',
                'user1:SYNTAX:102',
                'user1:NUANCE:201',
                'user2:SYNTAX:301'
            ];
            (mockRedis.spop as any).mockResolvedValue(items);

            await inventory.checkBufferAndFlush();

            expect(inventoryQueue.add).toHaveBeenCalledTimes(3);
            // 1. user1 SYNTAX [101, 102]
            // 2. user1 NUANCE [201]
            // 3. user2 SYNTAX [301]

            expect(inventoryQueue.add).toHaveBeenCalledWith(
                'replenish_batch',
                expect.objectContaining({
                    userId: 'user1',
                    mode: 'SYNTAX',
                    vocabIds: expect.arrayContaining([101, 102])
                }),
                expect.objectContaining({ priority: 5 })
            );
        });
    });

    describe('triggerEmergency', () => {
        it('should enqueue high priority job', async () => {
            await inventory.triggerEmergency('user1', 'SYNTAX', 999);
            expect(inventoryQueue.add).toHaveBeenCalledWith(
                'replenish_one',
                expect.objectContaining({
                    userId: 'user1',
                    mode: 'SYNTAX',
                    vocabId: 999,
                    correlationId: expect.stringContaining('emergency-999-')
                }),
                { priority: 1 }
            );
        });
    });

    describe('getInventoryStats', () => {
        it('should return parsed stats', async () => {
            (mockRedis.hgetall as any).mockResolvedValue({
                'SYNTAX': '5',
                'BLITZ': '10',
                // others undefined/missing
            });

            const stats = await inventory.getInventoryStats('user1');
            expect(stats).toEqual({
                SYNTAX: 5,
                CHUNKING: 0,
                NUANCE: 0,
                BLITZ: 10,
                total: 15
            });
        });
    });
});
