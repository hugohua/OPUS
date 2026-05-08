import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardFSRSSummaryMock = vi.fn();

const dbMock = {
    article: {
        findFirst: vi.fn(),
    },
};

vi.mock("@/lib/db", () => ({
    db: dbMock,
}));

vi.mock("@/lib/backend-core/dashboard/fsrs-summary", () => ({
    getDashboardFSRSSummary: getDashboardFSRSSummaryMock,
}));

describe("mobile dashboard summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDashboardFSRSSummaryMock.mockResolvedValue({
            mastered: 9,
            learning: 52,
            due: 48,
            telemetryScoreText: "56% R",
        });
        dbMock.article.findFirst.mockResolvedValueOnce(null);
    });

    it("returns the five Web-aligned core training entries for iOS Home", async () => {
        const { getMobileDashboardSummary } = await import("./dashboard");

        const summary = await getMobileDashboardSummary("user-1", "Hugo");

        expect(summary.trainingEntries.map((entry) => entry.id)).toEqual([
            "arena-blitz",
            "arena-mission",
            "phrase-deck",
            "drive-mode",
            "review-cards",
        ]);
        expect(summary.trainingEntries.find((entry) => entry.id === "phrase-deck")?.destination).toEqual({
            kind: "training",
            value: "PHRASE",
        });
        expect(summary.trainingEntries.find((entry) => entry.id === "drive-mode")?.destination).toEqual({
            kind: "drive",
            value: "SANDWICH",
        });
    });

    it("passes through FSRS telemetry from the shared dashboard core", async () => {
        const { getMobileDashboardSummary } = await import("./dashboard");

        const summary = await getMobileDashboardSummary("user-1", "Hugo");

        expect(getDashboardFSRSSummaryMock).toHaveBeenCalledWith("user-1", expect.any(Date));
        expect(summary.fsrs).toEqual({
            mastered: 9,
            learning: 52,
            due: 48,
            telemetryScoreText: "56% R",
        });
    });
});
