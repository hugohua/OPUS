import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getDashboardFSRSSummaryMock = vi.fn();
const userProgressCountMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("@/lib/backend-core/dashboard/fsrs-summary", () => ({
    getDashboardFSRSSummary: getDashboardFSRSSummaryMock,
}));

vi.mock("@/lib/db", () => ({
    db: {
        userProgress: { count: userProgressCountMock },
    },
}));

describe("getDashboardStats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMock.mockResolvedValue({ user: { id: "user-1" } });
        userProgressCountMock
            .mockResolvedValueOnce(48)
            .mockResolvedValueOnce(12);
        getDashboardFSRSSummaryMock.mockResolvedValue({
            mastered: 9,
            learning: 52,
            due: 48,
            telemetryScoreText: "56% R",
        });
    });

    it("returns FSRS telemetry from the shared dashboard core", async () => {
        const { getDashboardStats } = await import("../get-dashboard-stats");

        const stats = await getDashboardStats();

        expect(getDashboardFSRSSummaryMock).toHaveBeenCalledWith("user-1", expect.any(Date));
        expect(stats.fsrs).toEqual({
            mastered: 9,
            learning: 52,
            due: 48,
            telemetryScoreText: "56% R",
        });
    });
});
