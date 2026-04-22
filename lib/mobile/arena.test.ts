import { beforeEach, describe, expect, it, vi } from "vitest";

const getRadarDataMock = vi.fn();
const getActionRequiredNodesMock = vi.fn();
const getSyntaxMatrixDataMock = vi.fn();

vi.mock("@/actions/grammar-dashboard", () => ({
    getRadarData: getRadarDataMock,
    getActionRequiredNodes: getActionRequiredNodesMock,
    getSyntaxMatrixData: getSyntaxMatrixDataMock,
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
});
