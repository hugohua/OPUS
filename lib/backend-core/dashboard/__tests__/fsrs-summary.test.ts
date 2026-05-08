import { beforeEach, describe, expect, it, vi } from "vitest";

const userVocabStateCountMock = vi.fn();
const userProgressCountMock = vi.fn();

vi.mock("@/lib/db", () => ({
    db: {
        userVocabState: { count: userVocabStateCountMock },
        userProgress: { count: userProgressCountMock },
    },
}));

describe("dashboard FSRS summary core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("counts mastered, learning and due cards with Web/Mobile aligned filters", async () => {
        const now = new Date("2026-05-08T08:00:00.000Z");
        userVocabStateCountMock.mockResolvedValueOnce(9);
        userProgressCountMock
            .mockResolvedValueOnce(52)
            .mockResolvedValueOnce(48);

        const { getDashboardFSRSSummary } = await import("../fsrs-summary");

        const summary = await getDashboardFSRSSummary("user-1", now);

        expect(summary).toEqual({
            mastered: 9,
            learning: 52,
            due: 48,
            telemetryScoreText: "56% R",
        });
        expect(userVocabStateCountMock).toHaveBeenCalledWith({
            where: { userId: "user-1", status: "MASTERED" },
        });
        expect(userProgressCountMock).toHaveBeenNthCalledWith(1, {
            where: {
                userId: "user-1",
                track: "VISUAL",
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: {
                    userVocabStates: {
                        none: {
                            userId: "user-1",
                            status: "MASTERED",
                        },
                    },
                },
            },
        });
        expect(userProgressCountMock).toHaveBeenNthCalledWith(2, {
            where: {
                userId: "user-1",
                track: "VISUAL",
                next_review_at: { lte: now },
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: {
                    userVocabStates: {
                        none: {
                            userId: "user-1",
                            status: "MASTERED",
                        },
                    },
                },
            },
        });
    });

    it("returns 0% R when there is no dashboard telemetry", async () => {
        userVocabStateCountMock.mockResolvedValueOnce(0);
        userProgressCountMock
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);

        const { getDashboardFSRSSummary } = await import("../fsrs-summary");

        await expect(getDashboardFSRSSummary("user-1")).resolves.toEqual({
            mastered: 0,
            learning: 0,
            due: 0,
            telemetryScoreText: "0% R",
        });
    });
});
