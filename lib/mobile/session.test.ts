import { beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "ts-fsrs";

const getAudioSessionForUserMock = vi.fn();
const getReviewCardsMock = vi.fn();
const getNextDrillBatchMock = vi.fn();
const auditFSRSTransitionMock = vi.fn();

const prismaMock = {
    userProgress: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock("@/lib/session/audio", () => ({
    getAudioSessionForUser: getAudioSessionForUserMock,
}));

vi.mock("@/actions/get-next-drill", () => ({
    getNextDrillBatch: getNextDrillBatchMock,
}));

vi.mock("@/app/dashboard/cards/actions", () => ({
    getReviewCards: getReviewCardsMock,
}));

vi.mock("@/lib/db", () => ({
    prisma: prismaMock,
    db: prismaMock,
}));

vi.mock("@/lib/services/audit-service", () => ({
    auditFSRSTransition: auditFSRSTransitionMock,
}));

describe("mobile session adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    });

    it("passes the mobile user into audio availability queries", async () => {
        const { getMobileAudioAvailability } = await import("./session");

        getAudioSessionForUserMock.mockResolvedValueOnce({ items: [{ id: "item-1" }] });

        await getMobileAudioAvailability("user-123");

        expect(getAudioSessionForUserMock).toHaveBeenCalledWith("user-123");
    });

    it("passes the mobile user into review-card queries", async () => {
        const { getMobileReviewCards } = await import("./session");

        getReviewCardsMock.mockResolvedValueOnce([]);

        await getMobileReviewCards(20, "user-456");

        expect(getReviewCardsMock).toHaveBeenCalledWith(20, [], "user-456");
    });

    it("passes mixed-mode batch requests through to the drill action", async () => {
        const { getMobileSessionBatch } = await import("./session");

        getNextDrillBatchMock.mockResolvedValueOnce({
            status: "success",
            data: [{ meta: { vocabId: 1, mode: "DAILY_BLITZ" }, segments: [] }],
        });

        const result = await getMobileSessionBatch(
            {
                mode: "DAILY_BLITZ",
                limit: 5,
                excludeVocabIds: [7, 9],
            },
            "user-789"
        );

        expect(getNextDrillBatchMock).toHaveBeenCalledWith({
            userId: "user-789",
            mode: "DAILY_BLITZ",
            limit: 5,
            excludeVocabIds: [7, 9],
            forceRefresh: false,
        });
        expect(result).toHaveLength(1);
    });

    it("skips FSRS persistence for unanchored arena vocab ids", async () => {
        const { submitMobileSessionOutcome } = await import("./session");

        const zeroResult = await submitMobileSessionOutcome(
            {
                vocabId: 0,
                grade: 3,
                mode: "ARENA_PART5",
            },
            "user-123"
        );
        const negativeResult = await submitMobileSessionOutcome(
            {
                vocabId: -1,
                grade: 3,
                mode: "ARENA_PART5",
            },
            "user-123"
        );

        expect(zeroResult).toMatchObject({
            status: "success",
            message: "Outcome recorded (Skip FSRS for Pure Grammar)",
            data: null,
        });
        expect(negativeResult).toMatchObject({
            status: "success",
            message: "Outcome recorded (Skip FSRS for Pure Grammar)",
            data: null,
        });
        expect(prismaMock.userProgress.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.userProgress.upsert).not.toHaveBeenCalled();
    });

    it("caps cross-track easy grades before updating FSRS scores", async () => {
        const { submitMobileSessionOutcome } = await import("./session");

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
        prismaMock.userProgress.upsert.mockResolvedValueOnce({ id: "progress-1" });

        await submitMobileSessionOutcome(
            {
                vocabId: 42,
                grade: 4,
                mode: "SYNTAX",
                track: "CONTEXT",
            },
            "user-123"
        );

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
            }),
            expect.any(Object),
            expect.objectContaining({
                extraTags: ["cross_track_review"],
            }),
            prismaMock
        );
    });

    it("reuses the shared outcome helper for audio grades", async () => {
        const { submitMobileAudioGrade } = await import("./session");

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
        prismaMock.userProgress.upsert.mockResolvedValueOnce({ id: "progress-2" });

        await submitMobileAudioGrade(
            {
                vocabId: 88,
                grade: 3,
            },
            "user-123"
        );

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
});
