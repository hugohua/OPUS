/**
 * Weaver Generation 共享核心测试
 * 功能：
 *   固定移动端生成路径中的缓存、候选词和保存回调，不让 route 承载业务。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisGetMock = vi.fn();
const redisSetMock = vi.fn();
const userCountMock = vi.fn();
const vocabFindManyMock = vi.fn();
const articleCreateMock = vi.fn();
const articleVocabCreateManyMock = vi.fn();
const transactionMock = vi.fn();
const recordAuditMock = vi.fn();

vi.mock("@/lib/queue/connection", () => ({
    redis: {
        get: redisGetMock,
        set: redisSetMock,
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { count: userCountMock },
        vocab: { findMany: vocabFindManyMock },
        article: { create: articleCreateMock },
        articleVocab: { createMany: articleVocabCreateManyMock },
        $transaction: transactionMock,
    },
}));

vi.mock("@/lib/services/audit-service", () => ({
    recordAudit: recordAuditMock,
}));

vi.mock("../selection", () => ({
    getWeaverIngredientsForUser: vi.fn(async () => ({
        status: "success",
        data: {
            priorityWords: [{ id: 1, word: "audit", meaning: "审计" }],
            fillerWords: [],
        },
    })),
}));

describe("weaver generation core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userCountMock.mockResolvedValue(1);
        transactionMock.mockImplementation(async (callback) => callback({
            article: { create: articleCreateMock },
            articleVocab: { createMany: articleVocabCreateManyMock },
        }));
    });

    it("returns cached generation jobs without rebuilding prompts", async () => {
        const { createWeaverGenerationJobForUser } = await import("../generation");

        redisGetMock.mockResolvedValueOnce(JSON.stringify({ content: "cached body", articleId: "article-cache" }));

        await expect(createWeaverGenerationJobForUser("user-1", {
            scenario: "finance_group",
            density: "balanced",
            targetWordIds: [],
        })).resolves.toMatchObject({
            kind: "cached",
            articleId: "article-cache",
            content: "cached body",
        });
    });

    it("isolates generation cache by user id", async () => {
        const { createWeaverGenerationJobForUser } = await import("../generation");

        redisGetMock.mockResolvedValue(null);

        await createWeaverGenerationJobForUser("user-1", {
            scenario: "finance_group",
            density: "balanced",
            targetWordIds: [],
        });
        await createWeaverGenerationJobForUser("user-2", {
            scenario: "finance_group",
            density: "balanced",
            targetWordIds: [],
        });

        expect(redisGetMock.mock.calls[0][0]).not.toBe(redisGetMock.mock.calls[1][0]);
    });

    it("builds generation jobs and persists completed articles", async () => {
        const { createWeaverGenerationJobForUser } = await import("../generation");

        redisGetMock.mockResolvedValueOnce(null);
        vocabFindManyMock.mockResolvedValueOnce([{ id: 3, word: "budget", definition_cn: "预算", partOfSpeech: "n" }]);

        const job = await createWeaverGenerationJobForUser("user-1", {
            scenario: "finance_group",
            density: "balanced",
            targetWordIds: [3],
        });

        expect(job.kind).toBe("generate");
        if (job.kind !== "generate") throw new Error("Expected generate job");

        await job.onComplete("===TITLE===\nBudget Memo\n===BODY===\nBody");

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(articleCreateMock).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: "user-1",
                title: "Budget Memo",
            }),
        }));
        expect(articleVocabCreateManyMock).toHaveBeenCalledWith({
            data: [expect.objectContaining({ vocabId: 3, role: "TARGET" })],
        });
        expect(redisSetMock).toHaveBeenCalled();
        expect(recordAuditMock).toHaveBeenCalledTimes(2);
    });

    it("does not cache or complete audit when article persistence fails", async () => {
        const { createWeaverGenerationJobForUser } = await import("../generation");

        redisGetMock.mockResolvedValueOnce(null);
        vocabFindManyMock.mockResolvedValueOnce([{ id: 3, word: "budget", definition_cn: "预算", partOfSpeech: "n" }]);
        articleCreateMock.mockRejectedValueOnce(new Error("write failed"));

        const job = await createWeaverGenerationJobForUser("user-1", {
            scenario: "finance_group",
            density: "balanced",
            targetWordIds: [3],
        });

        expect(job.kind).toBe("generate");
        if (job.kind !== "generate") throw new Error("Expected generate job");

        await job.onComplete("===TITLE===\nBudget Memo\n===BODY===\nBody");

        expect(redisSetMock).not.toHaveBeenCalled();
        expect(recordAuditMock).toHaveBeenCalledTimes(1);
    });
});
