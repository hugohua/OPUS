/**
 * Vocabulary 共享核心测试
 * 功能：
 *   固定词库列表、详情和标签查询，避免 Action 作为跨端共享层。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const vocabCountMock = vi.fn();
const vocabFindManyMock = vi.fn();
const vocabFindUniqueMock = vi.fn();
const progressCountMock = vi.fn();
const progressFindManyMock = vi.fn();
const stateCountMock = vi.fn();
const queryRawMock = vi.fn();

vi.mock("@/lib/db", () => ({
    db: {
        vocab: { count: vocabCountMock, findMany: vocabFindManyMock, findUnique: vocabFindUniqueMock },
        userProgress: { count: progressCountMock, findMany: progressFindManyMock },
        userVocabState: { count: stateCountMock },
        $queryRaw: queryRawMock,
    },
    prisma: {
        vocab: { findUnique: vocabFindUniqueMock },
        userProgress: { findMany: progressFindManyMock },
    },
}));

describe("vocabulary core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("lists vocab for a concrete user without auth overrides", async () => {
        const { getVocabListForUser } = await import("../list");

        vocabCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(100);
        stateCountMock.mockResolvedValueOnce(2);
        progressCountMock.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
        vocabFindManyMock.mockResolvedValueOnce([{
            id: 1,
            word: "audit",
            phoneticUs: "/audit-us/",
            phoneticUk: "/audit-uk/",
            definition_cn: "审计",
            abceed_rank: 10,
            progress: [{
                status: "REVIEW",
                stability: 2,
                difficulty: 3,
                next_review_at: new Date("2026-04-23T00:00:00.000Z"),
                last_review_at: new Date("2026-04-22T00:00:00.000Z"),
                lapses: 0,
                lastContextSentence: "The audit starts.",
            }],
            userVocabStates: [{ status: "LEARNING", isFavorite: true }],
        }]);

        const result = await getVocabListForUser("user-1", { page: 1, limit: 20, status: "ALL" });

        expect(result.items[0]).toMatchObject({
            id: 1,
            word: "audit",
            phonetic: "/audit-us/",
            definition: "审计",
            fsrs: {
                status: "REVIEW",
                isFavorite: true,
                hasContext: true,
            },
        });
        expect(result.metadata.stats).toMatchObject({ mastered: 2, learning: 3, due: 4, totalVocab: 100 });
    });

    it("loads detail with multi-track progress", async () => {
        const { getVocabDetailForUser } = await import("../detail");

        vocabFindUniqueMock.mockResolvedValueOnce({ id: 7, word: "audit", etymology: null });
        progressFindManyMock.mockResolvedValueOnce([
            { track: "VISUAL", masteryMatrix: { userTags: ["finance"], userNote: "note" } },
            { track: "AUDIO", masteryMatrix: null },
        ]);

        await expect(getVocabDetailForUser("user-1", "7")).resolves.toMatchObject({
            vocab: { id: 7, word: "audit" },
            tracks: { VISUAL: { track: "VISUAL" }, AUDIO: { track: "AUDIO" }, CONTEXT: null },
            userTags: ["finance"],
            userNote: "note",
        });
    });

    it("returns sorted non-empty tags", async () => {
        const { getVocabTagsForUser } = await import("../tags");

        queryRawMock.mockResolvedValueOnce([{ tag: "finance" }, { tag: "" }, { tag: "audit" }]);

        await expect(getVocabTagsForUser("user-1")).resolves.toEqual(["audit", "finance"]);
    });
});
