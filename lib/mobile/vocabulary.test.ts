import { beforeEach, describe, expect, it, vi } from "vitest";

const getVocabListMock = vi.fn();
const getVocabDetailMock = vi.fn();
const queryRawMock = vi.fn();

vi.mock("@/actions/get-vocab-list", () => ({
    getVocabList: getVocabListMock,
}));

vi.mock("@/actions/get-vocab-detail", () => ({
    getVocabDetail: getVocabDetailMock,
}));

vi.mock("@/lib/db", () => ({
    db: {
        $queryRaw: queryRawMock,
    },
}));

describe("mobile vocabulary adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile bearer user into vocab list queries", async () => {
        const { getMobileVocabList } = await import("./vocabulary");

        getVocabListMock.mockResolvedValueOnce({ items: [], metadata: { total: 0 } });

        await getMobileVocabList({
            userId: "user-123",
            page: 2,
            status: "REVIEW",
            sort: "RANK",
            search: "audit",
        });

        expect(getVocabListMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userIdOverride: "user-123",
                page: 2,
                status: "REVIEW",
                sort: "RANK",
                search: "audit",
            })
        );
    });

    it("passes the mobile bearer user into vocab detail queries", async () => {
        const { getMobileVocabDetail } = await import("./vocabulary");

        getVocabDetailMock.mockResolvedValueOnce({ vocab: { id: 7 } });

        await getMobileVocabDetail("7", "user-456");

        expect(getVocabDetailMock).toHaveBeenCalledWith("7", "user-456");
    });

    it("returns sorted non-empty mobile tags", async () => {
        const { getMobileVocabTags } = await import("./vocabulary");

        queryRawMock.mockResolvedValueOnce([
            { tag: "finance" },
            { tag: "" },
            { tag: "audit" },
        ]);

        await expect(getMobileVocabTags("user-789")).resolves.toEqual(["audit", "finance"]);
        expect(queryRawMock).toHaveBeenCalledTimes(1);
    });
});
