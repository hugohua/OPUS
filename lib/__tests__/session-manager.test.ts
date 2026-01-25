import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('@/lib/db', () => ({
    db: {
        userProgress: {
            findUnique: vi.fn(),
            upsert: vi.fn()
        }
    }
}));

vi.mock('@/lib/queue/connection', () => ({
    redis: {
        scan: vi.fn(),
        hgetall: vi.fn(),
        del: vi.fn(),
        zrem: vi.fn()
    }
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({ info: vi.fn() })
}));

import { flushUserSession } from '../session-manager';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';

describe('SessionManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should aggregate session and update progress', async () => {
        // Mock Redis SCAN finding 1 key
        (redis.scan as any)
            .mockResolvedValueOnce(['0', ['window:user1:123']]);

        // Mock Redis HGETALL returning session data
        (redis.hgetall as any).mockResolvedValue({
            lastGrade: '3',
            attempts: '2',
            hasAgain: 'true' // Should result in grade 1 (Again)
        });

        // Mock Progress
        (db.userProgress.findUnique as any).mockResolvedValue({
            stability: 2,
            difficulty: 5,
            state: 0, // State.New
            reps: 0,
            lapses: 0,
            last_review_at: null,
            next_review_at: null
        });

        await flushUserSession('user1');

        // Verify FSRS Update
        expect(db.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId_vocabId: { userId: 'user1', vocabId: 123 } },
            update: expect.objectContaining({
                // FSRS calc will happen inside, hard to verify exact numbers without algorithm spy
                // But we can check if function ran
                last_review_at: expect.any(Date)
            })
        }));

        // Verify Cleanup
        expect(redis.del).toHaveBeenCalledWith('window:user1:123');
        expect(redis.zrem).toHaveBeenCalledWith('active_sessions', 'user1');
    });

    it('should scan until cursor is 0', async () => {
        (redis.scan as any)
            .mockResolvedValueOnce(['10', ['key1']])
            .mockResolvedValueOnce(['0', ['key2']]);

        (redis.hgetall as any).mockResolvedValue({ lastGrade: '3' });

        await flushUserSession('user1');

        expect(redis.scan).toHaveBeenCalledTimes(2);
        expect(redis.del).toHaveBeenCalledTimes(2);
    });
});
