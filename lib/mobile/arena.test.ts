import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptRecordPayload } from "@/lib/backend-core/arena/attempt";

const getArenaOverviewForUserMock = vi.fn();
const getArenaMatrixForUserMock = vi.fn();
const generateArenaMissionForUserMock = vi.fn();
const recordArenaAttemptForUserMock = vi.fn();

vi.mock("@/lib/backend-core/arena/dashboard", () => ({
    getArenaOverviewForUser: getArenaOverviewForUserMock,
    getArenaMatrixForUser: getArenaMatrixForUserMock,
}));

vi.mock("@/lib/backend-core/arena/mission", () => ({
    generateArenaMissionForUser: generateArenaMissionForUserMock,
}));

vi.mock("@/lib/backend-core/arena/attempt", () => ({
    recordArenaAttemptForUser: recordArenaAttemptForUserMock,
}));

describe("mobile arena adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile user into arena overview queries", async () => {
        const { getMobileArenaOverview } = await import("./arena");

        getArenaOverviewForUserMock.mockResolvedValueOnce({ radar: [], weakNodes: [], destinations: {} });

        await getMobileArenaOverview("user-123");

        expect(getArenaOverviewForUserMock).toHaveBeenCalledWith("user-123");
    });

    it("passes the mobile user into arena matrix queries", async () => {
        const { getMobileArenaMatrix } = await import("./arena");

        getArenaMatrixForUserMock.mockResolvedValueOnce(null);

        await getMobileArenaMatrix("L1_VERBS", "user-456");

        expect(getArenaMatrixForUserMock).toHaveBeenCalledWith("user-456", "L1_VERBS");
    });

    it("loads a mission session through the backend-core mission generator", async () => {
        const { getMobileArenaMission } = await import("./arena");

        generateArenaMissionForUserMock.mockResolvedValueOnce({
            meta: { format: "part6", mode: "ARENA_PART6" },
            segments: [],
        });

        const payload = await getMobileArenaMission({
            id: "user-789",
            name: "Hugo",
            email: "hugo@example.com",
        });

        expect(generateArenaMissionForUserMock).toHaveBeenCalledTimes(1);
        expect(generateArenaMissionForUserMock).toHaveBeenCalledWith("user-789");
        expect(payload).toEqual({
            meta: { format: "part6", mode: "ARENA_PART6" },
            segments: [],
        });
    });

    it("records arena attempts through the backend-core telemetry entrypoint", async () => {
        const { recordMobileArenaAttempt } = await import("./arena");

        recordArenaAttemptForUserMock.mockResolvedValueOnce({
            success: true,
            attemptId: "attempt-1",
        });

        const payload: AttemptRecordPayload = {
            questionSeedId: "seed-1",
            anchorVocabId: 42,
            isCorrect: false,
            responseTimeMs: 1200,
            selectedOption: "although",
            questionType: "GRAMMAR",
            part: 6,
            snapshotPayload: { meta: { target_word_blank_index: 1 }, segments: [] },
        };

        const result = await recordMobileArenaAttempt({
            id: "user-999",
            name: "Hugo",
            email: "hugo@example.com",
        }, payload);

        expect(recordArenaAttemptForUserMock).toHaveBeenCalledWith("user-999", payload);
        expect(result).toEqual({
            success: true,
            attemptId: "attempt-1",
        });
    });
});
