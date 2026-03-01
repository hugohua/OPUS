import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

import { auth } from '@/auth';
import { recordArenaOutcome } from '../arena-telemetry';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe('recordArenaOutcome', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

        // Mock QuestionSeed 查询
        (mockPrisma.questionSeed.findUnique as any).mockResolvedValue({
            grammarNodeId: null,
            difficulty: 2,
            targetAnswer: 'comply',
        });

        // Mock $transaction: 执行传入的回调
        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockPrisma));

        // Mock AttemptRecord.create 默认返回
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-1',
            userId: 'user-1',
            questionSeedId: 'seed-1',
            isCorrect: true,
        });
    });

    it('应该拒绝未认证的请求', async () => {
        mockAuth.mockResolvedValue(null);
        await expect(recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: true,
            responseTimeMs: 3000,
            selectedOption: 'comply',
            questionType: 'COLLOCATION',
            part: 5,
        })).rejects.toThrow('Unauthorized');
    });

    it('应该成功创建 AttemptRecord', async () => {
        const result = await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: true,
            responseTimeMs: 3000,
            selectedOption: 'comply',
            questionType: 'COLLOCATION',
            part: 5,
        });

        expect(result.success).toBe(true);
        expect(result.attemptId).toBe('attempt-1');
        expect(mockPrisma.attemptRecord.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                questionSeedId: 'seed-1',
                isCorrect: true,
                responseTimeMs: 3000,
                selectedOption: 'comply',
            }),
        });
    });

    it('答对时不应触发降维打击检查', async () => {
        await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: true,
            responseTimeMs: 2000,
            selectedOption: 'comply',
            questionType: 'COLLOCATION',
            part: 5,
        });

        // checkAndTriggerIntervention 内部调用 findMany，答对时不应调用
        expect(mockPrisma.attemptRecord.findMany).not.toHaveBeenCalled();
    });

    it('答错但无 anchorVocabId 时不应触发降维打击', async () => {
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-1', userId: 'user-1',
        });

        await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: null,
            isCorrect: false,
            responseTimeMs: 5000,
            selectedOption: 'wrong',
            questionType: 'GRAMMAR',
            part: 5,
        });

        expect(mockPrisma.attemptRecord.findMany).not.toHaveBeenCalled();
    });

    it('应该通过 Zod 拒绝无效的 questionType', async () => {
        await expect(recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: true,
            responseTimeMs: 3000,
            selectedOption: 'comply',
            questionType: 'INVALID_TYPE' as any,
            part: 5,
        })).rejects.toThrow();
    });
});

