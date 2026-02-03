import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBlitzSession } from '../get-blitz-session';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    const mock = mockDeep<PrismaClient>();
    return { prisma: mock, db: mock };
});
vi.mock('server-only', () => ({}));

// [Mock Auth]
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

import { auth } from '@/auth';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe('getBlitzSession (30/50/20 Protocol)', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();

        // Default: Auth Success
        mockAuth.mockResolvedValue({
            user: { id: 'u1' }
        });
    });

    const createMockVocab = (id: number, score: number, track: string = 'VISUAL') => ({
        id: `p-${track.toLowerCase()}-${id}`,
        vocabId: id,
        track,
        vocab: {
            id,
            word: `word-${id}`,
            frequency_score: score,
            collocations: [],
            definition_cn: 'test'
        }
    });

    it('should strictly enforce Rescue(6) + Review(10) + New(4) mix', async () => {
        // Mock Data for 3 Buckets

        // 1. Rescue Candidates (Assume 10 available, should take 6)
        const rescueList = Array.from({ length: 10 }, (_, i) => createMockVocab(100 + i, 90));

        // 2. Review Candidates (Assume 20 available, should take 10)
        const reviewList = Array.from({ length: 20 }, (_, i) => createMockVocab(200 + i, 80));

        // 3. New Candidates (Assume 10 available, should take 4)
        const newList = Array.from({ length: 10 }, (_, i) => createMockVocab(300 + i, 70));

        // Setup Mock Returns for the 3 parallel calls
        mockPrisma.userProgress.findMany
            .mockResolvedValueOnce(rescueList as any) // Rescue Call
            .mockResolvedValueOnce(reviewList as any) // Review Call
            .mockResolvedValueOnce(newList as any);   // New Call

        const result = await getBlitzSession();

        expect(result.status).toBe('success');
        const items = result.data?.items || [];

        expect(items.length).toBe(20);

        // Analyze Composition
        const ids = items.map(i => i.vocabId);

        const rescueIds = ids.filter(id => id >= 100 && id < 200);
        const reviewIds = ids.filter(id => id >= 200 && id < 300);
        const newIds = ids.filter(id => id >= 300 && id < 400);

        // Assert 30/50/20 Ratio
        expect(rescueIds.length).toBe(6);  // 30%
        expect(reviewIds.length).toBe(10); // 50%
        expect(newIds.length).toBe(4);     // 20%
    });

    it('should handle duplicates across buckets (Waterfall Deduplication by VocabId)', async () => {
        // Scenario: Same vocabId exists in multiple tracks (e.g., Visual and Audio)

        // Rescue: vocabId=100 (track=VISUAL)
        const rescueList = [createMockVocab(100, 90)];

        // Review: vocabId=100 (track=AUDIO, duplicate), plus other items
        const reviewList = [
            { id: 'p-audio-100', vocabId: 100, track: 'AUDIO', vocab: { id: 100, word: 'word-100', frequency_score: 90, collocations: [], definition_cn: 'test' } },
            ...Array.from({ length: 15 }, (_, i) => createMockVocab(200 + i, 80))
        ];

        // New: vocabId=300-309
        const newList = Array.from({ length: 10 }, (_, i) => createMockVocab(300 + i, 70));

        mockPrisma.userProgress.findMany
            .mockResolvedValueOnce(rescueList as any)
            .mockResolvedValueOnce(reviewList as any)
            .mockResolvedValueOnce(newList as any);

        const result = await getBlitzSession();
        const items = result.data?.items || [];

        // Total should still be 20
        expect(items.length).toBe(20);

        // Verification: vocabId=100 should only appear once (from Rescue, not Review)
        const vocab100Items = items.filter(i => i.vocabId === 100);
        expect(vocab100Items.length).toBe(1);

        // Verify composition: 1 Rescue (100) + 10 Review (from 200s) + 4 New (from 300s) + 5 backfill Review
        const reviewUniqueIds = items.filter(i => i.vocabId >= 200 && i.vocabId < 300).map(i => i.vocabId);
        expect(reviewUniqueIds.length).toBe(10 + 5); // Initial 10 + backfill 5 (since Rescue only had 1, needs 5 more to reach target 6)
    });

    it('should backfill from Review if Rescue is empty', async () => {
        // Rescue Empty
        const rescueList: any[] = [];

        // Review has plenty
        const reviewList = Array.from({ length: 30 }, (_, i) => createMockVocab(200 + i, 80));

        // New has plenty
        const newList = Array.from({ length: 10 }, (_, i) => createMockVocab(300 + i, 70));

        mockPrisma.userProgress.findMany
            .mockResolvedValueOnce(rescueList)
            .mockResolvedValueOnce(reviewList as any)
            .mockResolvedValueOnce(newList as any);

        const result = await getBlitzSession();
        const items = result.data?.items || [];

        expect(items.length).toBe(20);

        // Composition: 
        // Rescue: 0
        // Review: 10 (Protocol) + 6 (Backfill from Rescue gap) = 16
        // New: 4 (Protocol)

        const reviewIds = items.filter(i => i.vocabId >= 200 && i.vocabId < 300);
        const newIds = items.filter(i => i.vocabId >= 300);

        expect(reviewIds.length).toBe(16);
        expect(newIds.length).toBe(4);
    });
});
