import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNextDrillBatch } from '../get-next-drill';
import { prisma } from '@/lib/prisma';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { generateObject } from 'ai';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/prisma', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return { prisma: mockDeep<PrismaClient>() };
});
vi.mock('server-only', () => ({}));
vi.mock('ai', () => ({
    generateObject: vi.fn()
}));
vi.mock('@/lib/ai/client', () => ({
    getAIModel: vi.fn().mockReturnValue({ model: {}, modelName: 'test-model' }),
}));

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockGenerateObject = generateObject as unknown as ReturnType<typeof vi.fn>;

describe('getNextDrillBatch', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
    });

    it('should fetch candidates using 30/50/20 protocol and generate drill', async () => {
        // 1. Mock DB Responses
        // Rescue (0 found)
        mockPrisma.userProgress.findMany.mockResolvedValueOnce([]);

        // Review (2 found)
        mockPrisma.userProgress.findMany.mockResolvedValueOnce([
            { vocab: { id: 1, word: 'review1', definition_cn: 'def1', word_family: {}, frequency_score: 10 } },
            { vocab: { id: 2, word: 'review2', definition_cn: 'def2', word_family: {}, frequency_score: 20 } }
        ] as any);

        // New (1 found)
        mockPrisma.vocab.findMany.mockResolvedValueOnce([
            { id: 3, word: 'new1', definition_cn: 'def3', word_family: {}, frequency_score: 30 }
        ] as any);

        // Context Words (Mock $queryRaw)
        mockPrisma.$queryRaw.mockResolvedValue([{ word: 'ctx1' }]);

        // 2. Mock AI Response
        mockGenerateObject.mockResolvedValue({
            object: {
                drills: [
                    {
                        meta: { format: 'chat' },
                        segments: [{ type: 'text', content_markdown: 'test' }]
                    }, // Drill 1
                    { meta: { format: 'chat' }, segments: [] }, // Drill 2
                    { meta: { format: 'chat' }, segments: [] }  // Drill 3
                ]
            }
        });

        // 3. Execute
        const result = await getNextDrillBatch({ userId: 'cl00000000000000000000000', mode: 'SYNTAX' });

        // 4. Assert
        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(3);

        // Veryify 30/50/20 logic call structure
        expect(mockPrisma.userProgress.findMany).toHaveBeenCalledTimes(2);
        // Verify New called
        expect(mockPrisma.vocab.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return error if no candidates found', async () => {
        mockPrisma.userProgress.findMany.mockResolvedValue([]);
        mockPrisma.vocab.findMany.mockResolvedValue([]);

        const result = await getNextDrillBatch({ userId: 'cl00000000000000000000000', mode: 'SYNTAX' });

        expect(result.status).toBe('error');
        expect(result.message).toContain('No vocab candidates found');
    });
});
