import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueDrillGeneration, inventoryQueue, getQueueCounts, isQueuePaused, pauseQueue, resumeQueue, clearQueue } from '../inventory-queue';

// Mocks
vi.mock('bullmq', () => {
    return {
        Queue: vi.fn().mockImplementation(() => ({
            add: vi.fn(),
            getWaitingCount: vi.fn().mockResolvedValue(5),
            getActiveCount: vi.fn().mockResolvedValue(2),
            getCompletedCount: vi.fn().mockResolvedValue(10),
            getFailedCount: vi.fn().mockResolvedValue(1),
            getDelayedCount: vi.fn().mockResolvedValue(0),
            isPaused: vi.fn().mockResolvedValue(false),
            pause: vi.fn().mockResolvedValue(undefined),
            resume: vi.fn().mockResolvedValue(undefined),
            obliterate: vi.fn().mockResolvedValue(undefined),
        }))
    };
});

// Mock connection to avoid real redis connection
vi.mock('../connection', () => ({
    redis: {}
}));

describe('inventory-queue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('enqueueDrillGeneration', () => {
        it('should enqueue correct number of batches for SYNTAX mode (2 batches)', async () => {
            // SYNTAX target 20, batch size 10 -> 2 batches
            await enqueueDrillGeneration('user1', 'SYNTAX');
            expect(inventoryQueue.add).toHaveBeenCalledTimes(2);
            expect(inventoryQueue.add).toHaveBeenCalledWith(
                'generate-SYNTAX',
                expect.objectContaining({
                    userId: 'user1',
                    mode: 'SYNTAX',
                    priority: 'realtime'
                }),
                expect.objectContaining({ priority: 1 })
            );
        });

        it('should enqueue correct number of batches for NUANCE mode (5 batches)', async () => {
            // NUANCE target 50, batch size 10 -> 5 batches
            await enqueueDrillGeneration('user1', 'NUANCE');
            expect(inventoryQueue.add).toHaveBeenCalledTimes(5);
        });

        it('should handle priority correctly (cron -> priority 5)', async () => {
            await enqueueDrillGeneration('user1', 'BLITZ', 'cron');
            // BLITZ target 10 -> 1 batch
            expect(inventoryQueue.add).toHaveBeenCalledTimes(1);
            expect(inventoryQueue.add).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ priority: 'cron' }),
                expect.objectContaining({ priority: 5 })
            );
        });

        it('should generate unique correlationIds', async () => {
            await enqueueDrillGeneration('user1', 'SYNTAX');
            const calls = vi.mocked(inventoryQueue.add).mock.calls;
            const id1 = calls[0][1].correlationId;
            const id2 = calls[1][1].correlationId;
            expect(id1).not.toBe(id2);
            expect(id1).toContain('user1-SYNTAX-0-');
            expect(id2).toContain('user1-SYNTAX-1-');
        });
    });

    describe('Queue Management', () => {
        it('getQueueCounts should return all counts', async () => {
            const counts = await getQueueCounts();
            expect(counts).toEqual({
                waiting: 5,
                active: 2,
                completed: 10,
                failed: 1,
                delayed: 0
            });
            expect(inventoryQueue.getWaitingCount).toHaveBeenCalled();
        });

        it('isQueuePaused should delegate to queue', async () => {
            const paused = await isQueuePaused();
            expect(paused).toBe(false);
            expect(inventoryQueue.isPaused).toHaveBeenCalled();
        });

        it('pauseQueue should delegate to queue', async () => {
            await pauseQueue();
            expect(inventoryQueue.pause).toHaveBeenCalled();
        });

        it('resumeQueue should delegate to queue', async () => {
            await resumeQueue();
            expect(inventoryQueue.resume).toHaveBeenCalled();
        });

        it('clearQueue should delegate to queue with force option', async () => {
            await clearQueue();
            expect(inventoryQueue.obliterate).toHaveBeenCalledWith({ force: true });
        });
    });
});
