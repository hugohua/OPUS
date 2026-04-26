import { beforeEach, describe, expect, it, vi } from "vitest";

const generateDrivePlaylistForUserMock = vi.fn();

vi.mock("@/lib/drive/playlist", () => ({
    generateDrivePlaylistForUser: generateDrivePlaylistForUserMock,
}));

describe("mobile drive adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("validates query options and passes the mobile user to the shared playlist helper", async () => {
        const { getMobileDrivePlaylist } = await import("./drive");

        generateDrivePlaylistForUserMock.mockResolvedValueOnce({
            items: [{ id: "1", text: "audit", mode: "QUIZ" }],
            track: "VISUAL",
            mode: "SANDWICH",
        });

        const result = await getMobileDrivePlaylist(
            {
                mode: "SANDWICH",
                track: "VISUAL",
                batch: "30",
            },
            "user-123"
        );

        expect(generateDrivePlaylistForUserMock).toHaveBeenCalledWith("user-123", {
            mode: "SANDWICH",
            track: "VISUAL",
            batchSize: 30,
        });
        expect(result).toMatchObject({
            mode: "SANDWICH",
            track: "VISUAL",
            batchSize: 30,
            items: [{ id: "1", text: "audit", mode: "QUIZ" }],
        });
    });

    it("rejects invalid query options before querying the playlist helper", async () => {
        const { getMobileDrivePlaylist } = await import("./drive");

        expect(() =>
            getMobileDrivePlaylist(
                {
                    mode: "UNKNOWN",
                    track: "VISUAL",
                    batch: "30",
                },
                "user-123"
            )
        ).toThrow("Invalid drive playlist options");
        expect(() =>
            getMobileDrivePlaylist(
                {
                    mode: "SANDWICH",
                    track: "UNKNOWN",
                    batch: "30",
                },
                "user-123"
            )
        ).toThrow("Invalid drive playlist options");
        expect(() =>
            getMobileDrivePlaylist(
                {
                    mode: "SANDWICH",
                    track: "VISUAL",
                    batch: "99",
                },
                "user-123"
            )
        ).toThrow("Invalid drive playlist options");
        expect(generateDrivePlaylistForUserMock).not.toHaveBeenCalled();
    });
});
