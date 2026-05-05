import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptRecordPayload } from "@/actions/arena-telemetry";

const getRadarDataMock = vi.fn();
const getActionRequiredNodesMock = vi.fn();
const getSyntaxMatrixDataMock = vi.fn();
const generatePart6SessionForUserMock = vi.fn();
const recordArenaOutcomeForUserMock = vi.fn();

vi.mock("@/actions/grammar-dashboard", () => ({
    getRadarData: getRadarDataMock,
    getActionRequiredNodes: getActionRequiredNodesMock,
    getSyntaxMatrixData: getSyntaxMatrixDataMock,
}));

vi.mock("@/actions/part6-queue", () => ({
    generatePart6SessionForUser: generatePart6SessionForUserMock,
}));

vi.mock("@/actions/arena-telemetry", () => ({
    recordArenaOutcomeForUser: recordArenaOutcomeForUserMock,
}));

describe("mobile arena adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile user into arena overview queries", async () => {
        const { getMobileArenaOverview } = await import("./arena");

        getRadarDataMock.mockResolvedValueOnce([]);
        getActionRequiredNodesMock.mockResolvedValueOnce([]);

        await getMobileArenaOverview("user-123");

        expect(getRadarDataMock).toHaveBeenCalledWith("user-123");
        expect(getActionRequiredNodesMock).toHaveBeenCalledWith("user-123");
    });

    it("passes the mobile user into arena matrix queries", async () => {
        const { getMobileArenaMatrix } = await import("./arena");

        getSyntaxMatrixDataMock.mockResolvedValueOnce(null);

        await getMobileArenaMatrix("L1_VERBS", "user-456");

        expect(getSyntaxMatrixDataMock).toHaveBeenCalledWith("L1_VERBS", "user-456");
    });

    it("loads a mission session through the existing part 6 generator", async () => {
        const { getMobileArenaMission } = await import("./arena");

        generatePart6SessionForUserMock.mockResolvedValueOnce({
            meta: { format: "part6", mode: "ARENA_PART6" },
            segments: [],
        });

        const payload = await getMobileArenaMission({
            id: "user-789",
            name: "Hugo",
            email: "hugo@example.com",
        });

        expect(generatePart6SessionForUserMock).toHaveBeenCalledTimes(1);
        expect(generatePart6SessionForUserMock).toHaveBeenCalledWith("user-789");
        expect(payload).toEqual({
            meta: { format: "part6", mode: "ARENA_PART6" },
            segments: [],
        });
    });

    it("records arena attempts through the existing telemetry action", async () => {
        const { recordMobileArenaAttempt } = await import("./arena");

        recordArenaOutcomeForUserMock.mockResolvedValueOnce({
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

        expect(recordArenaOutcomeForUserMock).toHaveBeenCalledWith("user-999", payload);
        expect(result).toEqual({
            success: true,
            attemptId: "attempt-1",
        });
    });
});
