import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordSelectionService } from '@/lib/services/WordSelectionService';
import { prisma } from '@/lib/db';

// Mock prisma
vi.mock('@/lib/db', () => ({
    prisma: {
        $queryRaw: vi.fn(),
        userProgress: {
            findMany: vi.fn(),
        },
        vocab: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        user: { upsert: vi.fn() } // If used in service constructor or init
    },
}));

describe('WordSelectionService', () => {
    const userId = 'test-user-1';
    let service: WordSelectionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new WordSelectionService(userId);
    });

    describe('selectContextWords (Hybrid Mode)', () => {
        const mockTarget = {
            id: 1,
            word: 'target',
            scenarios: ['business'],
            learningPriority: 100,
            embedding: {} // Mock embedding existence
        } as any;

        it('should use Vector Search results when available', async () => {
            const mockVectorResults = [
                { id: 2, word: 'vector1' },
                { id: 3, word: 'vector2' },
                { id: 4, word: 'vector3' },
                { id: 5, word: 'vector4' },
                { id: 6, word: 'vector5' },
            ];

            // Mock $queryRaw to return vector results
            (prisma.$queryRaw as any).mockResolvedValue(mockVectorResults);

            const result = await service.selectContextWords(mockTarget, 5);

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(result).toHaveLength(5);
            expect(result[0].word).toBe('vector1');
        });

        it('should fallback to Tag Search when Vector Search returns empty', async () => {
            // Mock $queryRaw to return empty
            (prisma.$queryRaw as any).mockResolvedValue([]);

            // Mock Tag Search (findMany)
            const mockTagResults = [
                { vocab: { id: 4, word: 'tag1', scenarios: ['business'] } },
                { vocab: { id: 5, word: 'tag2', scenarios: ['business'] } },
            ];
            (prisma.userProgress.findMany as any).mockResolvedValue(mockTagResults);

            const result = await service.selectContextWords(mockTarget, 5);

            expect(prisma.$queryRaw).toHaveBeenCalled(); // Tried vector
            expect(prisma.userProgress.findMany).toHaveBeenCalled(); // Fell back to tag
            expect(result).toHaveLength(2);
            expect(result[0].word).toBe('tag1');
        });

        it('should combine Vector and Tag results when Vector is insufficient', async () => {
            // Vector returns 1
            const mockVectorResults = [{ id: 2, word: 'vector1' }];
            (prisma.$queryRaw as any).mockResolvedValue(mockVectorResults);

            // Tag returns 4 more
            const mockTagResults = [
                { vocab: { id: 4, word: 'tag1', scenarios: ['business'] } },
                { vocab: { id: 5, word: 'tag2', scenarios: ['business'] } },
                { vocab: { id: 6, word: 'tag3', scenarios: ['business'] } },
                { vocab: { id: 7, word: 'tag4', scenarios: ['business'] } },
            ];
            (prisma.userProgress.findMany as any).mockResolvedValue(mockTagResults);

            const result = await service.selectContextWords(mockTarget, 5);

            expect(prisma.$queryRaw).toHaveBeenCalled();
            expect(prisma.userProgress.findMany).toHaveBeenCalled();

            expect(result).toHaveLength(5);
            expect(result[0].word).toBe('vector1'); // Priority
            expect(result[1].word).toBe('tag1');    // Fallback
        });
    });
});
