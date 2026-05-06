import { beforeEach, describe, expect, it, vi } from "vitest";

const getVocabListForUserMock = vi.fn();
const getVocabDetailForUserMock = vi.fn();
const getVocabTagsForUserMock = vi.fn();

vi.mock("@/lib/backend-core/vocabulary/list", () => ({
    getVocabListForUser: getVocabListForUserMock,
}));

vi.mock("@/lib/backend-core/vocabulary/detail", () => ({
    getVocabDetailForUser: getVocabDetailForUserMock,
}));

vi.mock("@/lib/backend-core/vocabulary/tags", () => ({
    getVocabTagsForUser: getVocabTagsForUserMock,
}));

describe("mobile vocabulary adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile bearer user into vocab list queries", async () => {
        const { getMobileVocabList } = await import("./vocabulary");

        getVocabListForUserMock.mockResolvedValueOnce({ items: [], metadata: { total: 0 } });

        await getMobileVocabList({
            userId: "user-123",
            page: 2,
            status: "REVIEW",
            sort: "RANK",
            search: "audit",
        });

        expect(getVocabListForUserMock).toHaveBeenCalledWith(
            "user-123",
            expect.objectContaining({
                page: 2,
                status: "REVIEW",
                sort: "RANK",
                search: "audit",
            })
        );
    });

    it("passes the mobile bearer user into vocab detail queries", async () => {
        const { getMobileVocabDetail } = await import("./vocabulary");

        getVocabDetailForUserMock.mockResolvedValueOnce({ vocab: { id: 7 } });

        await getMobileVocabDetail("7", "user-456");

        expect(getVocabDetailForUserMock).toHaveBeenCalledWith("user-456", "7");
    });

    it("returns sorted non-empty mobile tags", async () => {
        const { getMobileVocabTags } = await import("./vocabulary");

        getVocabTagsForUserMock.mockResolvedValueOnce(["audit", "finance"]);

        await expect(getMobileVocabTags("user-789")).resolves.toEqual(["audit", "finance"]);
        expect(getVocabTagsForUserMock).toHaveBeenCalledWith("user-789");
    });
});
