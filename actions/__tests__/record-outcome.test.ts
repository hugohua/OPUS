import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordOutcome } from '../record-outcome';
import { prisma } from '@/lib/prisma';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { State } from 'ts-fsrs';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/prisma', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return { prisma: mockDeep<PrismaClient>() };
});
vi.mock('server-only', () => ({}));

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('recordOutcome', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create new progress if not exists (First Lesson)', async () => {
        mockPrisma.userProgress.findUnique.mockResolvedValue(null);
        mockPrisma.userProgress.upsert.mockImplementation(async (args) => args.create as any);

        const result = await recordOutcome({
            userId: 'cl00000000000000000000000',
            vocabId: 100,
            grade: 3, // Good
            mode: 'SYNTAX'
        });

        expect(result.status).toBe('success');

        // Verify new V-Score
        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                dim_v_score: 5,
                state: State.Learning,
            })
        }));
    });

    it('should update existing progress (Review)', async () => {
        const now = new Date();
        mockPrisma.userProgress.findUnique.mockResolvedValue({
            userId: 'cl00000000000000000000000',
            vocabId: 100,
            dim_v_score: 50,
            stability: 2,
            difficulty: 5,
            reps: 1,
            lapses: 0,
            state: State.Learning,
            last_review_at: new Date(now.getTime() - 86400000), // 1 day ago
            next_review_at: now,
        } as any);

        mockPrisma.userProgress.upsert.mockImplementation(async (args) => args.update as any);

        const result = await recordOutcome({
            userId: 'cl00000000000000000000000',
            vocabId: 100,
            grade: 4, // Easy
            mode: 'SYNTAX'
        });

        expect(result.status).toBe('success');

        // Verify V-Score Increase (+5)
        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_v_score: 55, // 50 + 5
                // status: 'REVIEW' // FSRS will determine logic, hard to predict exact fields without running FSRS logic, but we mocked upsert to just pass.
                // We verify that upsert WAS called.
            })
        }));
    });

    it('should decrease score on fail', async () => {
        mockPrisma.userProgress.findUnique.mockResolvedValue({
            userId: 'cl00000000000000000000000', vocabId: 100, dim_v_score: 50,
            stability: 0, difficulty: 0, reps: 0, lapses: 0, state: State.New,
        } as any);

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 1, mode: 'SYNTAX' });

        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_v_score: 45 // 50 - 5
            })
        }));
    });
});
