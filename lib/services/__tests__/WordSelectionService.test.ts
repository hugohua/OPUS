import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordSelectionService } from '@/lib/services/WordSelectionService';
import { ContextSelector } from '@/lib/ai/context-selector';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Mock prisma (Keep for selectTargetWord if needed, though not tested in this block)
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        prisma: mockDeep<PrismaClient>(),
    };
});

// Mock ContextSelector
vi.mock('@/lib/ai/context-selector', () => ({
    ContextSelector: {
        select: vi.fn()
    }
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe('WordSelectionService', () => {
    const userId = 'test-user-1';
    let service: WordSelectionService;

    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks(); // Clear ContextSelector mock
        service = new WordSelectionService(userId);
    });

    describe('selectContextWords (Delegation Mode)', () => {
        const mockTarget = {
            id: 1,
            word: 'target',
            scenarios: ['business'],
        } as any;

        it('should delegate to ContextSelector with correct params', async () => {
            const mockResults = [
                { id: 2, word: 'c1' },
                { id: 3, word: 'c2' },
                { id: 4, word: 'c3' },
                { id: 5, word: 'c4' },
                { id: 6, word: 'c5' },
            ];

            // Setup ContextSelector mock
            (ContextSelector.select as any).mockResolvedValue(mockResults);

            const result = await service.selectContextWords(mockTarget, 5);

            // Assert delegation
            expect(ContextSelector.select).toHaveBeenCalledWith(
                userId,
                1,
                expect.objectContaining({
                    count: 5,
                    strategies: ['USER_VECTOR', 'TAG'],
                    minDistance: 0.15,
                    excludeIds: [1]
                })
            );

            // Assert return value propagation
            expect(result).toHaveLength(5);
            expect(result[0].word).toBe('c1');
        });

        it('should return empty array if ContextSelector returns empty', async () => {
            (ContextSelector.select as any).mockResolvedValue([]);

            const result = await service.selectContextWords(mockTarget, 5);

            expect(result).toHaveLength(0);
        });
    });
});
