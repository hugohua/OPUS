import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridSelector } from '../hybrid-selector';
import { db } from '@/lib/db';

vi.mock('../../generated/prisma/client', () => ({
    PrismaClient: vi.fn()
}));

// Mock db
vi.mock('@/lib/db', () => ({
    db: {
        vocab: {
            findMany: vi.fn(),
        },
        userProgress: {
            findMany: vi.fn(),
        },
        $queryRawUnsafe: vi.fn(),
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    }
}));

describe('HybridSelector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should respect 30/50/20 ratio for mixed queues', async () => {
        // Setup Mocks

        // 1. Rescue (Limit 6) - Return 3 (less than limit)
        (db.vocab.findMany as any).mockResolvedValue([
            { id: 1 }, { id: 2 }, { id: 3 }
        ]);

        // 2. Review (Limit 10 + 3 unused rescue = 13) - Return 13
        (db.userProgress.findMany as any).mockResolvedValue(
            Array.from({ length: 13 }, (_, i) => ({ vocab: { id: 10 + i } }))
        );

        // 3. New (Limit 20 - 3 - 13 = 4) - Return 4
        (db.$queryRawUnsafe as any).mockResolvedValue(
            Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, partOfSpeech: 'v.' }))
        );

        const result = await HybridSelector.selectWords('user1');

        expect(result.rescue).toHaveLength(3);
        expect(result.review).toHaveLength(13); // Took spillover
        expect(result.new).toHaveLength(4);
        expect(result.all).toHaveLength(20);

        // Verify priorities in calls
        // Rescue logic check
        expect(db.vocab.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 6,
                where: expect.objectContaining({
                    progress: expect.objectContaining({
                        some: expect.anything()
                    })
                })
            })
        );
    });

    it('should fill completely with New items if others empty', async () => {
        (db.vocab.findMany as any).mockResolvedValue([]); // No rescue
        (db.userProgress.findMany as any).mockResolvedValue([]); // No review
        (db.$queryRawUnsafe as any).mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => ({ id: i }))
        );

        const result = await HybridSelector.selectWords('user1');

        expect(result.rescue).toHaveLength(0);
        expect(result.review).toHaveLength(0);
        expect(result.new).toHaveLength(20);
    });

    it('should handle database errors gracefully in New Acquisition', async () => {
        (db.vocab.findMany as any).mockResolvedValue([]);
        (db.userProgress.findMany as any).mockResolvedValue([]);
        (db.$queryRawUnsafe as any).mockRejectedValue(new Error('DB Fail'));

        const result = await HybridSelector.selectWords('user1');

        // Should not crash, just return empty for that section
        expect(result.new).toHaveLength(0);
        expect(result.all).toHaveLength(0);
    });
});
