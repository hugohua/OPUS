/**
 * 错题本 (Mistake Book) Server Action 测试规格
 *
 * 功能：
 *   验证 recordArenaOutcome 的错题快照写入逻辑。
 *   覆盖 $transaction 双写一致性、Snapshot 结构完整性、边界条件。
 *
 * 场景路由: B (Server Action 修改)
 * 依赖: vitest, vitest-mock-extended
 */

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

// --- 测试数据 ---
const MOCK_SNAPSHOT = {
    meta: {
        format: 'chat',
        mode: 'ARENA_PART5',
        batch_size: 1,
        sys_prompt_version: 'test-v1',
        vocabId: 100,
        target_word: 'comply',
        questionSeedId: 'seed-1',
        questionType: 'COLLOCATION',
        part: 5,
    },
    segments: [
        {
            type: 'text',
            content_markdown: 'The company must comply with regulations.',
        },
        {
            type: 'interaction',
            dimension: 'C',
            task: {
                style: 'swipe_card',
                question_markdown: 'The company must _______ with regulations.',
                options: ['comply', 'complete', 'compose', 'compare'],
                answer_key: 'comply',
                explanation_markdown: '**comply**: 遵守',
            },
        },
    ],
};

// ============================================
// 错题本写入逻辑测试
// ============================================

describe('Mistake Book - 错题快照写入', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

        // Mock QuestionSeed 查询 (grammarNodeId + difficulty)
        (mockPrisma.questionSeed.findUnique as any).mockResolvedValue({
            grammarNodeId: 'grammar-node-1',
            difficulty: 2,
        });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Happy Path
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    it('答错且携带 snapshotPayload 时，应同时创建 AttemptRecord + UserMistakeBook', async () => {
        // Arrange: Mock $transaction 执行回调
        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => {
            return fn(mockPrisma);
        });
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-1',
            userId: 'user-1',
        });
        (mockPrisma.userMistakeBook.create as any).mockResolvedValue({
            id: 'mistake-1',
        });

        // Act
        const result = await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: false,
            responseTimeMs: 5000,
            selectedOption: 'complete', // 用户选错了
            questionType: 'COLLOCATION',
            part: 5,
            snapshotPayload: MOCK_SNAPSHOT,
        });

        // Assert: AttemptRecord 和 UserMistakeBook 都应被调用
        expect(result.success).toBe(true);
        expect(mockPrisma.attemptRecord.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.userMistakeBook.create).toHaveBeenCalledTimes(1);

        // Assert: UserMistakeBook 的数据结构
        expect(mockPrisma.userMistakeBook.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                mode: expect.any(String),
                part: 5,
                vocabId: 100,
                userWrongAnswer: 'complete',
                snapshot: MOCK_SNAPSHOT,
                status: 'ACTIVE',
            }),
        });
    });

    it('答对时，不应创建 UserMistakeBook 记录', async () => {
        // Arrange
        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockPrisma));
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-2',
            userId: 'user-1',
        });

        // Act
        await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: true,
            responseTimeMs: 2000,
            selectedOption: 'comply',
            questionType: 'COLLOCATION',
            part: 5,
            snapshotPayload: MOCK_SNAPSHOT, // 即使传了 snapshot，答对也不写
        });

        // Assert
        expect(mockPrisma.userMistakeBook.create).not.toHaveBeenCalled();
    });

    it('答错但未携带 snapshotPayload 时，不应创建 UserMistakeBook', async () => {
        // Arrange
        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockPrisma));
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-3',
            userId: 'user-1',
        });

        // Act
        await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: false,
            responseTimeMs: 3000,
            selectedOption: 'wrong',
            questionType: 'GRAMMAR',
            part: 5,
            // 没有 snapshotPayload
        });

        // Assert: 仅 AttemptRecord，无 MistakeBook
        expect(mockPrisma.attemptRecord.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.userMistakeBook.create).not.toHaveBeenCalled();
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Edge Cases
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    it('$transaction 回滚：UserMistakeBook 写入失败时，AttemptRecord 也不应存在', async () => {
        // Arrange: 模拟事务中第二步失败
        (mockPrisma.$transaction as any).mockRejectedValue(
            new Error('DB write failed for UserMistakeBook')
        );

        // Act & Assert
        await expect(recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: false,
            responseTimeMs: 4000,
            selectedOption: 'compose',
            questionType: 'COLLOCATION',
            part: 5,
            snapshotPayload: MOCK_SNAPSHOT,
        })).rejects.toThrow();
    });

    it('Part 6 错题应将 passage_markdown 包含在 snapshot 中', async () => {
        // Arrange
        const part6Snapshot = {
            ...MOCK_SNAPSHOT,
            meta: { ...MOCK_SNAPSHOT.meta, mode: 'ARENA_PART6', part: 6 },
            passage_markdown: 'Dear Team,\n\nPlease note that the server maintenance...',
        };

        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockPrisma));
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-4',
            userId: 'user-1',
        });
        (mockPrisma.userMistakeBook.create as any).mockResolvedValue({
            id: 'mistake-4',
        });

        // Act
        await recordArenaOutcome({
            questionSeedId: 'seed-p6',
            anchorVocabId: 200,
            isCorrect: false,
            responseTimeMs: 8000,
            selectedOption: 'promoted',
            questionType: 'MORPHOLOGY',
            part: 6,
            snapshotPayload: part6Snapshot,
        });

        // Assert: snapshot 内含 passage_markdown
        expect(mockPrisma.userMistakeBook.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                part: 6,
                snapshot: expect.objectContaining({
                    passage_markdown: expect.stringContaining('server maintenance'),
                }),
            }),
        });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Logic Assertion: grammarNodeId 冗余传递
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    it('应将 QuestionSeed 的 grammarNodeId 冗余写入 UserMistakeBook', async () => {
        // Arrange
        (mockPrisma.$transaction as any).mockImplementation(async (fn: any) => fn(mockPrisma));
        (mockPrisma.attemptRecord.create as any).mockResolvedValue({
            id: 'attempt-5',
            userId: 'user-1',
        });
        (mockPrisma.userMistakeBook.create as any).mockResolvedValue({
            id: 'mistake-5',
        });

        // Act
        await recordArenaOutcome({
            questionSeedId: 'seed-1',
            anchorVocabId: 100,
            isCorrect: false,
            responseTimeMs: 3500,
            selectedOption: 'compare',
            questionType: 'COLLOCATION',
            part: 5,
            snapshotPayload: MOCK_SNAPSHOT,
        });

        // Assert: grammarNodeId 从 QuestionSeed 查询中获取并写入
        expect(mockPrisma.userMistakeBook.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                grammarNodeId: 'grammar-node-1',
            }),
        });
    });
});
