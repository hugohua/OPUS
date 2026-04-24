import { beforeEach, describe, expect, it, vi } from "vitest";

const getWeaverIngredientsMock = vi.fn();
const articleFindFirstMock = vi.fn();
const articleFindManyMock = vi.fn();
const articleDeleteMock = vi.fn();
const articleVocabDeleteManyMock = vi.fn();
const vocabFindFirstMock = vi.fn();

vi.mock("@/actions/weaver-selection", () => ({
    getWeaverIngredients: getWeaverIngredientsMock,
}));

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
        vocab: {
            findFirst: vocabFindFirstMock,
        },
    },
}));

describe("mobile briefing adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile user through the briefing ingredients query", async () => {
        const { getMobileBriefingIngredients } = await import("./briefing");

        getWeaverIngredientsMock.mockResolvedValueOnce({
            status: "success",
            data: {
                priorityWords: [],
                fillerWords: [],
            },
        });

        const payload = await getMobileBriefingIngredients("user-123", "finance_group", false);

        expect(getWeaverIngredientsMock).toHaveBeenCalledWith("user-123", "finance_group", false, "user-123");
        expect(payload.availableScenarios).toContain("finance_group");
        expect(payload.availableScenarios.every((scenario) => typeof scenario === "string")).toBe(true);
    });

    it("maps a stored article into the mobile reader payload", async () => {
        const { getMobileBriefingDetail } = await import("./briefing");

        articleFindFirstMock.mockResolvedValueOnce({
            id: "article-7",
            title: "Quarterly Audit",
            createdAt: new Date("2026-04-23T08:00:00.000Z"),
            summaryZh: "审查摘要",
            body: {
                content: "===TITLE===\nQuarterly Audit\n===BODY===\nBody paragraph\n\nSecond paragraph\n===TRANSLATION===\n译文一\n\n译文二",
                context: {
                    scenarioId: "finance_group",
                    density: "dense",
                },
            },
            vocabs: [
                {
                    vocab: {
                        id: 11,
                        word: "audit",
                        definition_cn: "审计",
                    },
                },
            ],
        });

        await expect(getMobileBriefingDetail("user-123", "article-7")).resolves.toEqual({
            id: "article-7",
            title: "Quarterly Audit",
            createdAt: "2026-04-23T08:00:00.000Z",
            summaryZh: "审查摘要",
            scenario: "finance_group",
            density: "dense",
            content: "===TITLE===\nQuarterly Audit\n===BODY===\nBody paragraph\n\nSecond paragraph\n===TRANSLATION===\n译文一\n\n译文二",
            targetWords: [
                {
                    id: 11,
                    word: "audit",
                    meaning: "审计",
                },
            ],
        });
    });

    it("looks up a wand word using the local vocab cache", async () => {
        const { getMobileBriefingWandWord } = await import("./briefing");

        vocabFindFirstMock.mockResolvedValueOnce({
            id: 42,
            phoneticUk: "/ˈɔːdɪt/",
            definition_cn: "审计",
            etymology: {
                mode: "ROOTS",
                memory_hook: "audire",
                data: { root: "aud" },
            },
        });

        await expect(getMobileBriefingWandWord("Audit")).resolves.toEqual({
            vocab: {
                phonetic: "/ˈɔːdɪt/",
                meaning: "审计",
            },
            etymology: {
                mode: "ROOTS",
                memory_hook: "audire",
                data: { root: "aud" },
            },
            ai_insight: null,
        });
    });

    it("loads history with scenario and status filters", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));

        const { getMobileBriefingHistory } = await import("./briefing");

        articleFindManyMock.mockResolvedValueOnce([
            {
                id: "article-new",
                title: "Finance memo",
                createdAt: new Date("2026-04-23T10:00:00.000Z"),
                body: {
                    context: {
                        scenarioId: "finance_group",
                        density: "balanced",
                    },
                },
                vocabs: [{ vocab: { word: "audit" } }],
            },
        ]);

        await expect(
            getMobileBriefingHistory("user-123", { scenario: "finance_group", status: "new" })
        ).resolves.toEqual({
            items: [
                {
                    id: "article-new",
                    title: "Finance memo",
                    createdAt: "2026-04-23T10:00:00.000Z",
                    scenario: "finance_group",
                    status: "new",
                    vocabPreview: "audit",
                },
            ],
            availableScenarios: [
                "finance_group",
                "hr_group",
                "ops_group",
                "market_group",
                "office_group",
                "travel_group",
            ],
        });

        expect(articleFindManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-123",
                    createdAt: expect.objectContaining({
                        gte: new Date("2026-04-22T12:00:00.000Z"),
                    }),
                    OR: [
                        {
                            body: {
                                path: ["context", "scenarioId"],
                                equals: "finance_group",
                            },
                        },
                        {
                            title: {
                                startsWith: "finance_group",
                            },
                        },
                    ],
                }),
            })
        );

        vi.useRealTimers();
    });

    it("deletes an owned article and clears vocab links first", async () => {
        const { deleteMobileBriefingArticle } = await import("./briefing");

        articleFindFirstMock.mockResolvedValueOnce({ id: "article-9" });
        articleVocabDeleteManyMock.mockResolvedValueOnce({ count: 2 });
        articleDeleteMock.mockResolvedValueOnce({ id: "article-9" });

        await expect(deleteMobileBriefingArticle("user-123", "article-9")).resolves.toEqual({ success: true });

        expect(articleVocabDeleteManyMock).toHaveBeenCalledWith({
            where: { articleId: "article-9" },
        });
        expect(articleDeleteMock).toHaveBeenCalledWith({
            where: { id: "article-9" },
        });
    });
});
