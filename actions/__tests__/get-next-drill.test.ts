import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNextDrillBatch } from '../get-next-drill';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { generateObject } from 'ai';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    const mock = mockDeep<PrismaClient>();
    return { prisma: mock, db: mock };
});
vi.mock('server-only', () => ({}));
vi.mock('@/lib/inventory', () => ({
    inventory: {
        popDrill: vi.fn(),
        triggerBatchEmergency: vi.fn().mockResolvedValue(true)
    }
}));
vi.mock('@/lib/ai/client', () => ({
    getAIModel: vi.fn().mockReturnValue({ model: {}, modelName: 'test-model' }),
}));

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('getNextDrillBatch', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
    });

    it('should fetch candidates using 30/50/20 protocol and generate drill (Fallback)', async () => {
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

        // 2. Mock Inventory Response (All Miss -> Fallback)
        const { inventory } = await import('@/lib/inventory');
        vi.mocked(inventory.popDrill).mockResolvedValue(null);

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

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(0);
        expect(result.message).toContain('No candidates found');
    });

    it('should use Fast Path for PHRASE mode', async () => {
        // 1. Mock Candidates
        mockPrisma.userProgress.findMany.mockResolvedValue([]);
        mockPrisma.vocab.findMany.mockResolvedValue([
            { id: 10, word: 'phrase_word', definition_cn: 'def', word_family: {}, frequency_score: 50, collocations: [{ text: 'phrase', trans: 'phrase trans' }] }
        ] as any);

        // 3. Execute
        const result = await getNextDrillBatch({ userId: 'cl00000000000000000000000', mode: 'PHRASE', limit: 1 });

        // 4. Assert
        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(1);

        // Check Source Metadata
        const drill = result.data![0];
        // Note: buildPhraseDrill sets source='db_collocation' but getNextDrillBatch overrides to 'fast_path_db'
        expect((drill.meta as any).source).toBe('fast_path_db');

        // Ensure Inventory was SKIPPED
        const { inventory } = await import('@/lib/inventory');
        expect(inventory.popDrill).not.toHaveBeenCalled();
    });

    it('should trigger Plan B (Emergency Replenish) when inventory is empty', async () => {
        // Mock DB for candidates (Fall back to Plan A/C generation logic, but here we test the Trigger side effect)
        // Wait, getNextDrillBatch logic:
        // 1. Try Inventory -> popDrill.
        // 2. If null -> Collect missed VocabId?
        // Actually, getNextDrillBatch logic:
        // const drill = await inventory.popDrill(...);
        // if (!drill) { missedVocabIds.push(candidate.vocabId); ... }
        // finally { if (missed.length > 0) inventory.triggerBatchEmergency(...) }

        // Setup:
        // 1. Candidate found via DB (Fast Path candidate?)
        // Wait, Fast Path candidates are checked for collocations.
        // If Standard Mode?
        // Candidates fetched via `fetchCandidates`.
        (mockPrisma.vocab.findMany as any).mockResolvedValue([
            { id: 200, word: 'emergency', definition_cn: '紧急', word_family: {}, frequency_score: 50, collocations: [] }
        ]);
        (mockPrisma.userProgress.findMany as any).mockResolvedValue([]);
        (mockPrisma.$queryRaw as any).mockResolvedValue([{ word: 'ctx1' }]);

        // 2. Inventory Pop returns NULL
        const { inventory } = await import('@/lib/inventory');
        (inventory.popDrill as any).mockResolvedValue(null);

        // 3. Execute
        const result = await getNextDrillBatch({ userId: 'cl00000000000000000000000', mode: 'SYNTAX', limit: 1 });
        if (result.status === 'error') console.log('DEBUG PLAN B:', result.message);

        // 4. Verification
        expect(result.status).toBe('success');
        // Fallback happened (Plan A)
        expect((result.data![0].meta as any).source).toBe('deterministic_fallback');

        // CRITICAL: Verify Plan B Trigger
        expect(inventory.triggerBatchEmergency).toHaveBeenCalledWith(
            'cl00000000000000000000000', 'SYNTAX', expect.arrayContaining([200])
        );
    });
});
