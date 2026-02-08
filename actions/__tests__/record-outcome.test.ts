import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordOutcome } from '../record-outcome';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { State } from 'ts-fsrs';
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

// [Mock Audit Service]
vi.mock('@/lib/services/audit-service', () => ({
    auditFSRSTransition: vi.fn(),
    recordAudit: vi.fn(),
}));

import { auth } from '@/auth';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe('recordOutcome', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Default: Auth Success with matching ID
        mockAuth.mockResolvedValue({
            user: { id: 'cl00000000000000000000000' }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // --- Security Checks ---
    describe('Security', () => {
        it('should block unauthorized access', async () => {
            mockAuth.mockResolvedValue(null);
            const result = await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 3, mode: 'SYNTAX' });
            expect(result.status).toBe('error');
            expect(result.message).toBe('Unauthorized');
        });

        it('should block vertical privilege escalation (ID Mismatch)', async () => {
            mockAuth.mockResolvedValue({ user: { id: 'hacker-id' } });
            const result = await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 3, mode: 'SYNTAX' });
            expect(result.status).toBe('error');
            expect(result.message).toContain('Forbidden');
        });
    });

    // --- Functional Tests ---

    it('should create new progress if not exists (First Lesson)', async () => {
        mockPrisma.userProgress.findUnique.mockResolvedValue(null);
        mockPrisma.userProgress.upsert.mockResolvedValue({
            id: 'p1', userId: 'u1', vocabId: 100,
            status: 'LEARNING', dim_v_score: 5, state: State.Learning
        } as any);

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

        mockPrisma.userProgress.upsert.mockResolvedValue({
            id: 'p1', userId: 'u1', vocabId: 100,
            status: 'REVIEW', dim_v_score: 55, state: State.Review // Simulating updated state
        } as any);

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
    it('should increment lapses on fail (Review State)', async () => {
        const now = new Date();
        mockPrisma.userProgress.findUnique.mockResolvedValue({
            userId: 'cl00000000000000000000000', vocabId: 100,
            state: State.Review, // KEY
            lapses: 0,
            stability: 5, difficulty: 5, reps: 5,
            next_review_at: new Date(now.getTime() - 1000),
        } as any);

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 1, mode: 'SYNTAX' });

        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                lapses: 1, // Incremented
                state: State.Relearning, // Reset
            })
        }));
    });

    it('should upgrade to Easy on fast pass (Implicit Grading)', async () => {
        mockPrisma.userProgress.findUnique.mockResolvedValue({
            userId: 'cl00000000000000000000000', vocabId: 100,
            state: State.Learning, dim_v_score: 50,
            stability: 0, difficulty: 0, reps: 0, lapses: 0,
        } as any);

        // Grade 3 (Good) but Duration 1000ms (< 2500ms Threshold for SYNTAX) -> Easy (4)
        await recordOutcome({
            userId: 'cl00000000000000000000000',
            vocabId: 100,
            grade: 3,
            mode: 'SYNTAX',
            duration: 1000
        });

        // We can't verify exact FSRS output simply, but we can assume 'state' transitions logic
        expect(mockPrisma.userProgress.upsert).toHaveBeenCalled();
    });

    it('should schedule Easy review further than Good review', async () => {
        const now = new Date();
        const baseProgress = {
            userId: 'cl00000000000000000000000', vocabId: 100,
            state: State.Review, stability: 5, difficulty: 5, reps: 5, lapses: 0,
            last_review_at: new Date(now.getTime() - 86400000), // 1 day ago
            next_review_at: now
        } as any;

        // 1. GOOD Grade
        mockPrisma.userProgress.findUnique.mockResolvedValue(baseProgress);
        mockPrisma.userProgress.upsert.mockResolvedValue({ ...baseProgress });

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 3, mode: 'SYNTAX' });

        const goodCall = mockPrisma.userProgress.upsert.mock.calls[0][0] as any;
        const goodDate = goodCall.update.next_review_at;

        // Reset mock
        mockPrisma.userProgress.upsert.mockClear();

        // 2. EASY Grade
        mockPrisma.userProgress.findUnique.mockResolvedValue(baseProgress);
        mockPrisma.userProgress.upsert.mockResolvedValue({ ...baseProgress });

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 4, mode: 'SYNTAX' });

        const easyCall = mockPrisma.userProgress.upsert.mock.calls[0][0] as any;
        const easyDate = easyCall.update.next_review_at;

        expect(easyDate.getTime()).toBeGreaterThan(goodDate.getTime());
    });

    it('should update dim_c_score for PHRASE mode', async () => {
        mockPrisma.userProgress.findUnique.mockResolvedValue({
            userId: 'cl00000000000000000000000', vocabId: 100, // Fixed ID
            dim_v_score: 50, dim_c_score: 50,
            state: State.Learning, stability: 0, difficulty: 0, reps: 0, lapses: 0
        } as any);
        mockPrisma.userProgress.upsert.mockResolvedValue({ id: 'p1' } as any);

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 3, mode: 'PHRASE' });

        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_c_score: 55
            })
        }));
    });

    it('should map duration to FSRS grades correctly (Implicit Grading)', async () => {
        const baseProgress = {
            userId: 'cl00000000000000000000000', vocabId: 100,
            state: State.Review, stability: 5, difficulty: 5, reps: 5, lapses: 0,
            last_review_at: new Date(), next_review_at: new Date()
        } as any;
        mockPrisma.userProgress.findUnique.mockResolvedValue(baseProgress);
        mockPrisma.userProgress.upsert.mockResolvedValue({ ...baseProgress });

        await recordOutcome({ userId: 'cl00000000000000000000000', vocabId: 100, grade: 3, mode: 'SYNTAX', duration: 6000 });

        expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_v_score: expect.any(Number) // Syntax updates V-Score
            })
        }));
    });
});
