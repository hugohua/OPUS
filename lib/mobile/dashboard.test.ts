import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
    userProgress: {
        count: vi.fn(),
    },
    article: {
        findFirst: vi.fn(),
    },
};

vi.mock("@/lib/db", () => ({
    db: dbMock,
}));

describe("mobile dashboard summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbMock.userProgress.count
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(34)
            .mockResolvedValueOnce(5);
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
});
