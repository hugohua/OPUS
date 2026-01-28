import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextSelector } from '@/lib/ai/context-selector';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Mock prisma
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        prisma: mockDeep<PrismaClient>(),
    };
});

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe('ContextSelector', () => {
    const userId = 'test-user-1';

    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe('select() Scenarios', () => {
        const mockTarget = {
            id: 1,
            word: 'target',
            scenarios: ['business']
        } as any;

        const mockOptions = {
            count: 3,
            strategies: ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'] as any
        };

        // 1. Ideal Path / Happy Path
        it('should fulfill request purely from User Vector (Strategy A)', async () => {
            // Target has embedding
            prismaMock.vocab.findUnique.mockResolvedValue(mockTarget);
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ has_embedding: true }]) // Check embedding
                .mockResolvedValueOnce([ // User Vector
                    { id: 10, word: 'u1' }, { id: 11, word: 'u2' }, { id: 12, word: 'u3' }
                ]);

            const result = await ContextSelector.select(userId, 1, mockOptions);

            expect(result).toHaveLength(3);
            expect(result.map(r => r.word)).toEqual(['u1', 'u2', 'u3']);
            expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2); // 1 check + 1 user vector
        });

        // 2. Cold Start (No User Progress)
        it('should fallback to Global Vector (Strategy B) when User Vector returns empty', async () => {
            prismaMock.vocab.findUnique.mockResolvedValue(mockTarget);
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ has_embedding: true }]) // Check embedding
                .mockResolvedValueOnce([]) // User Vector (Empty)
                .mockResolvedValueOnce([ // Global Vector
                    { id: 20, word: 'g1' }, { id: 21, word: 'g2' }, { id: 22, word: 'g3' }
                ]);

            const result = await ContextSelector.select(userId, 1, mockOptions);

            expect(result).toHaveLength(3);
            expect(result.map(r => r.word)).toEqual(['g1', 'g2', 'g3']);
        });

        // 3. Hybrid Splice (Partial User + Partial Global)
        it('should combine User Vector and Global Vector results', async () => {
            prismaMock.vocab.findUnique.mockResolvedValue(mockTarget);
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ has_embedding: true }])
                .mockResolvedValueOnce([{ id: 10, word: 'u1' }]) // User Vector (Only 1)
                .mockResolvedValueOnce([{ id: 20, word: 'g1' }, { id: 21, word: 'g2' }]); // Global Vector (Needs 2 more)

            const result = await ContextSelector.select(userId, 1, mockOptions);

            expect(result).toHaveLength(3);
            expect(result[0].word).toBe('u1'); // Priority 1
            expect(result[1].word).toBe('g1'); // Priority 2
        });

        // 4. Missing Embedding (Graceful Degradation)
        it('should skip Vector strategies if Target has no embedding, falling back to Random', async () => {
            prismaMock.vocab.findUnique.mockResolvedValue(mockTarget);
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ has_embedding: false }]) // No embedding
                // User Vector and Global Vector are skipped logic-wise
                .mockResolvedValueOnce([ // Random Fallback
                    { id: 30, word: 'r1' }, { id: 31, word: 'r2' }, { id: 32, word: 'r3' }
                ]);

            const result = await ContextSelector.select(userId, 1, mockOptions);

            expect(result).toHaveLength(3);
            expect(result[0].word).toBe('r1');
            // Logic ensure we didn't try vector queries (which would fail/warn)
            // Call count: 1 check + 1 random
            expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
        });

        // 5. Large Request (Article Generation)
        it('should accumulate results for large requests (1+15)', async () => {
            prismaMock.vocab.findUnique.mockResolvedValue(mockTarget);

            // Mock sequence
            prismaMock.$queryRaw
                .mockResolvedValueOnce([{ has_embedding: true }]) // Check
                // Generate unique IDs for each batch
                .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 100 + i, word: 'user_vec' })))
                .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, word: 'global_vec' })))
                .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 300 + i, word: 'random' })));

            const result = await ContextSelector.select(userId, 1, { ...mockOptions, count: 15 });

            expect(result).toHaveLength(15);
        });
    });
});
