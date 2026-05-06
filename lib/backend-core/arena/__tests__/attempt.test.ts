/**
 * Arena Attempt 共享核心测试
 * 功能：
 *   固定 Arena telemetry、错题本和 BKT 更新的跨端共享入口。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const questionSeedFindUniqueMock = vi.fn();
const attemptCreateMock = vi.fn();
const mistakeCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/db", () => ({
    prisma: {
        questionSeed: { findUnique: questionSeedFindUniqueMock },
        attemptRecord: {
            create: attemptCreateMock,
            findMany: vi.fn(),
        },
        userMistakeBook: { create: mistakeCreateMock },
        userGrammarProficiency: {
            upsert: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
        },
        grammarNode: { findUnique: vi.fn() },
        userProgress: { findUnique: vi.fn(), update: vi.fn() },
        vocab: { findUnique: vi.fn() },
        drillAudit: { create: vi.fn() },
        $transaction: transactionMock,
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    },
}));

vi.mock("@/lib/algorithm/bkt", () => ({
    updateBkt: vi.fn(() => ({
        newMasteryScore: 0.6,
        newExposureCount: 1,
        newCorrectCount: 1,
    })),
}));

describe("arena attempt core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        questionSeedFindUniqueMock.mockResolvedValue({
            grammarNodeId: "grammar-1",
            difficulty: 2,
            targetAnswer: "because",
        });
        attemptCreateMock.mockResolvedValue({ id: "attempt-1" });
        transactionMock.mockImplementation(async (callback) => callback({
            attemptRecord: { create: attemptCreateMock },
            userMistakeBook: { create: mistakeCreateMock },
        }));
    });

    it("records attempts without requiring Web auth", async () => {
        const { recordArenaAttemptForUser } = await import("../attempt");

        const result = await recordArenaAttemptForUser("user-1", {
            questionSeedId: "seed-1",
            anchorVocabId: 42,
            isCorrect: true,
            responseTimeMs: 700,
            selectedOption: "because",
            questionType: "GRAMMAR",
            part: 5,
        });

        expect(result).toEqual({ success: true, attemptId: "attempt-1" });
        expect(attemptCreateMock).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: "user-1",
                questionSeedId: "seed-1",
                anchorVocabId: 42,
                isCorrect: true,
            }),
        });
    });

    it("writes mistake-book snapshots inside the attempt transaction", async () => {
        const { recordArenaAttemptForUser } = await import("../attempt");

        await recordArenaAttemptForUser("user-1", {
            questionSeedId: "seed-1",
            anchorVocabId: 42,
            isCorrect: false,
            responseTimeMs: 900,
            selectedOption: "although",
            questionType: "GRAMMAR",
            part: 6,
            snapshotPayload: {
                meta: { mode: "ARENA_PART6", target_word_blank_index: 1 },
                segments: [{
                    type: "interaction",
                    task: { answer_key: "because", options: [] },
                }],
            },
        });

        expect(transactionMock).toHaveBeenCalled();
        expect(mistakeCreateMock).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: "user-1",
                attemptRecordId: "attempt-1",
                mode: "ARENA_PART6",
                correctAnswer: "because",
                userWrongAnswer: "although",
            }),
        });
    });
});
