/**
 * Session Outcome 共享核心测试
 * 功能：
 *   固定 Web 端 FSRS 回流规则，确保 Web、H5、iOS 适配层共用同一业务核心。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "ts-fsrs";

const auditFSRSTransitionMock = vi.fn();

const prismaMock = {
    userVocabState: {
        findUnique: vi.fn(),
    },
    userProgress: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
    prisma: prismaMock,
    db: prismaMock,
}));

vi.mock("@/lib/services/audit-service", () => ({
    auditFSRSTransition: auditFSRSTransitionMock,
}));

describe("recordSessionOutcomeForUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.userVocabState.findUnique.mockResolvedValue(null);
        prismaMock.userProgress.findUnique.mockResolvedValue(null);
        prismaMock.userProgress.upsert.mockResolvedValue({ id: "progress-1" });
        prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    });

    it("skips FSRS persistence for pure grammar drills", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");

        const result = await recordSessionOutcomeForUser("user-123", {
            vocabId: 0,
            grade: 3,
            mode: "ARENA_PART5",
        });

        expect(result).toMatchObject({
            status: "success",
            message: "Outcome recorded (Skip FSRS for Pure Grammar)",
            data: null,
        });
        expect(prismaMock.userVocabState.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.userProgress.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.userProgress.upsert).not.toHaveBeenCalled();
    });

    it("skips FSRS persistence for word-level mastered vocab", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");
        prismaMock.userVocabState.findUnique.mockResolvedValueOnce({ status: "MASTERED" });

        const result = await recordSessionOutcomeForUser("user-123", {
            vocabId: 42,
            grade: 3,
            mode: "SYNTAX",
        });

        expect(result).toMatchObject({
            status: "success",
            message: "Outcome ignored for mastered vocab",
            data: null,
        });
        expect(prismaMock.userProgress.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.userProgress.upsert).not.toHaveBeenCalled();
    });

    it("updates phrase outcomes on the drafting dimension", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");
        prismaMock.userProgress.findUnique.mockResolvedValueOnce({
            userId: "user-123",
            vocabId: 42,
            track: "VISUAL",
            dim_v_score: 50,
            dim_c_score: 50,
            dim_a_score: 0,
            dim_m_score: 0,
            dim_x_score: 0,
            stability: 0,
            difficulty: 0,
            reps: 0,
            lapses: 0,
            state: State.Learning,
        });

        await recordSessionOutcomeForUser("user-123", {
            vocabId: 42,
            grade: 3,
            mode: "PHRASE",
        });

        expect(prismaMock.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_c_score: 53,
            }),
        }));
    });

    it("updates audio outcomes on the audio dimension", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");
        prismaMock.userProgress.findUnique.mockResolvedValueOnce({
            userId: "user-123",
            vocabId: 88,
            track: "AUDIO",
            dim_v_score: 0,
            dim_c_score: 0,
            dim_a_score: 20,
            dim_m_score: 0,
            dim_x_score: 0,
            stability: 2,
            difficulty: 5,
            reps: 1,
            lapses: 0,
            state: State.Learning,
            last_review_at: new Date("2026-04-22T00:00:00.000Z"),
            next_review_at: new Date("2026-04-23T00:00:00.000Z"),
        });

        await recordSessionOutcomeForUser("user-123", {
            vocabId: 88,
            grade: 3,
            mode: "AUDIO",
        });

        expect(prismaMock.userProgress.findUnique).toHaveBeenCalledWith({
            where: {
                userId_vocabId_track: {
                    userId: "user-123",
                    vocabId: 88,
                    track: "AUDIO",
                },
            },
        });
        expect(prismaMock.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_a_score: 23,
            }),
        }));
    });

    it("updates context outcomes on the logic dimension", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");
        prismaMock.userProgress.findUnique.mockResolvedValueOnce({
            userId: "user-123",
            vocabId: 99,
            track: "CONTEXT",
            dim_v_score: 0,
            dim_c_score: 0,
            dim_a_score: 0,
            dim_m_score: 0,
            dim_x_score: 40,
            stability: 2,
            difficulty: 5,
            reps: 1,
            lapses: 0,
            state: State.Learning,
        });

        await recordSessionOutcomeForUser("user-123", {
            vocabId: 99,
            grade: 3,
            mode: "CONTEXT",
        });

        expect(prismaMock.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_x_score: 43,
            }),
        }));
    });

    it("caps cross-track Easy grades to Good before auditing and score updates", async () => {
        const { recordSessionOutcomeForUser } = await import("../outcome");
        const now = new Date("2026-04-23T00:00:00.000Z");
        prismaMock.userProgress.findUnique.mockResolvedValueOnce({
            userId: "user-123",
            vocabId: 42,
            track: "CONTEXT",
            dim_v_score: 10,
            dim_c_score: 0,
            dim_a_score: 0,
            dim_m_score: 0,
            dim_x_score: 40,
            stability: 5,
            difficulty: 5,
            reps: 3,
            lapses: 0,
            state: State.Review,
            last_review_at: new Date(now.getTime() - 86_400_000),
            next_review_at: now,
        });

        await recordSessionOutcomeForUser("user-123", {
            vocabId: 42,
            grade: 4,
            mode: "SYNTAX",
            track: "CONTEXT",
        });

        expect(prismaMock.userProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                dim_x_score: 43,
            }),
        }));
        expect(auditFSRSTransitionMock).toHaveBeenCalledWith(
            "user-123",
            expect.objectContaining({
                vocabId: 42,
                track: "CONTEXT",
                grade: 3,
                gradeLabel: "Good",
            }),
            expect.any(Object),
            expect.objectContaining({
                extraTags: ["cross_track_review"],
            }),
            prismaMock
        );
    });
});
