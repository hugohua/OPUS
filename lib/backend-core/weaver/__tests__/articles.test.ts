/**
 * Weaver Articles 共享核心测试
 * 功能：
 *   固定简报查询、历史映射和事务删除行为，避免 mobile adapter 直接写库。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const articleFindFirstMock = vi.fn();
const articleFindManyMock = vi.fn();
const articleDeleteMock = vi.fn();
const articleVocabDeleteManyMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/db", () => ({
    db: {
        article: {
            findFirst: articleFindFirstMock,
            findMany: articleFindManyMock,
            delete: articleDeleteMock,
        },
        articleVocab: {
            deleteMany: articleVocabDeleteManyMock,
        },
        $transaction: transactionMock,
    },
}));

describe("weaver articles core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        transactionMock.mockImplementation(async (callback) => callback({
            articleVocab: { deleteMany: articleVocabDeleteManyMock },
            article: { delete: articleDeleteMock },
        }));
    });

    it("maps article details into the mobile/Web shared reader payload", async () => {
        const { getBriefingDetailForUser } = await import("../articles");

        articleFindFirstMock.mockResolvedValueOnce({
            id: "article-1",
            title: "Quarterly Audit",
            createdAt: new Date("2026-04-23T08:00:00.000Z"),
            summaryZh: "审计摘要",
            body: {
                content: "body",
                context: { scenarioId: "finance_group", density: "dense" },
            },
            vocabs: [{ vocab: { id: 11, word: "audit", definition_cn: "审计" } }],
        });

        await expect(getBriefingDetailForUser("user-1", "article-1")).resolves.toEqual({
            id: "article-1",
            title: "Quarterly Audit",
            createdAt: "2026-04-23T08:00:00.000Z",
            summaryZh: "审计摘要",
            scenario: "finance_group",
            density: "dense",
            content: "body",
            targetWords: [{ id: 11, word: "audit", meaning: "审计" }],
        });
    });

    it("loads history using scenario and age filters", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
        const { getBriefingHistoryForUser } = await import("../articles");

        articleFindManyMock.mockResolvedValueOnce([{
            id: "article-new",
            title: "Finance memo",
            createdAt: new Date("2026-04-23T10:00:00.000Z"),
            body: { context: { scenarioId: "finance_group" } },
            vocabs: [{ vocab: { word: "audit" } }],
        }]);

        await expect(
            getBriefingHistoryForUser("user-1", { scenario: "finance_group", status: "new" })
        ).resolves.toMatchObject({
            items: [{ id: "article-new", scenario: "finance_group", status: "new", vocabPreview: "audit" }],
        });

        expect(articleFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: "user-1",
                createdAt: { gte: new Date("2026-04-22T12:00:00.000Z") },
                OR: [
                    { body: { path: ["context", "scenarioId"], equals: "finance_group" } },
                    { title: { startsWith: "finance_group" } },
                ],
            }),
        }));
        vi.useRealTimers();
    });

    it("deletes article links and article in one transaction", async () => {
        const { deleteBriefingArticleForUser } = await import("../articles");

        articleFindFirstMock.mockResolvedValueOnce({ id: "article-9" });
        articleVocabDeleteManyMock.mockResolvedValueOnce({ count: 2 });
        articleDeleteMock.mockResolvedValueOnce({ id: "article-9" });

        await expect(deleteBriefingArticleForUser("user-1", "article-9")).resolves.toEqual({ success: true });

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(articleVocabDeleteManyMock).toHaveBeenCalledWith({ where: { articleId: "article-9" } });
        expect(articleDeleteMock).toHaveBeenCalledWith({ where: { id: "article-9" } });
    });
});
