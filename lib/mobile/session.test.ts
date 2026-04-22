import { beforeEach, describe, expect, it, vi } from "vitest";

const getAudioSessionMock = vi.fn();
const getReviewCardsMock = vi.fn();

vi.mock("@/actions/audio-session", () => ({
    getAudioSession: getAudioSessionMock,
}));

vi.mock("@/app/dashboard/cards/actions", () => ({
    getReviewCards: getReviewCardsMock,
}));

describe("mobile session adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile user into audio availability queries", async () => {
        const { getMobileAudioAvailability } = await import("./session");

        getAudioSessionMock.mockResolvedValueOnce({
            status: "success",
            data: { items: [{ id: "item-1" }] },
        });

        await getMobileAudioAvailability("user-123");

        expect(getAudioSessionMock).toHaveBeenCalledWith("user-123");
    });

    it("passes the mobile user into review-card queries", async () => {
        const { getMobileReviewCards } = await import("./session");

        getReviewCardsMock.mockResolvedValueOnce([]);

        await getMobileReviewCards(20, "user-456");

        expect(getReviewCardsMock).toHaveBeenCalledWith(20, [], "user-456");
    });
});
