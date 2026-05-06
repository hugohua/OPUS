import { beforeEach, describe, expect, it, vi } from "vitest";

const getWeaverIngredientsForUserMock = vi.fn();
const getBriefingDetailForUserMock = vi.fn();
const getBriefingHistoryForUserMock = vi.fn();
const deleteBriefingArticleForUserMock = vi.fn();
const lookupWandWordMock = vi.fn();

vi.mock("@/lib/backend-core/weaver/selection", () => ({
    getWeaverIngredientsForUser: getWeaverIngredientsForUserMock,
}));

vi.mock("@/lib/backend-core/weaver/articles", () => ({
    getLatestBriefingForUser: vi.fn(),
    getBriefingDetailForUser: getBriefingDetailForUserMock,
    getBriefingHistoryForUser: getBriefingHistoryForUserMock,
    deleteBriefingArticleForUser: deleteBriefingArticleForUserMock,
}));

vi.mock("@/lib/backend-core/weaver/wand", () => ({
    lookupWandWord: lookupWandWordMock,
    createWandAnalyzeStreamJob: vi.fn(),
}));

describe("mobile briefing adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the mobile user through the briefing ingredients query", async () => {
        const { getMobileBriefingIngredients } = await import("./briefing");

        getWeaverIngredientsForUserMock.mockResolvedValueOnce({
            status: "success",
            data: {
                priorityWords: [],
                fillerWords: [],
            },
        });

        const payload = await getMobileBriefingIngredients("user-123", "finance_group", false);

        expect(getWeaverIngredientsForUserMock).toHaveBeenCalledWith("user-123", "finance_group", false);
        expect(payload.availableScenarios).toContain("finance_group");
        expect(payload.availableScenarios.every((scenario) => typeof scenario === "string")).toBe(true);
    });

    it("maps a stored article into the mobile reader payload", async () => {
        const { getMobileBriefingDetail } = await import("./briefing");
        const articlePayload = {
            id: "article-7",
            title: "Quarterly Audit",
            createdAt: "2026-04-23T08:00:00.000Z",
            summaryZh: "审查摘要",
            scenario: "finance_group",
            density: "dense",
            content: "body",
            targetWords: [{ id: 11, word: "audit", meaning: "审计" }],
        };

        getBriefingDetailForUserMock.mockResolvedValueOnce(articlePayload);

        await expect(getMobileBriefingDetail("user-123", "article-7")).resolves.toEqual(articlePayload);
        expect(getBriefingDetailForUserMock).toHaveBeenCalledWith("user-123", "article-7");
    });

    it("looks up a wand word using the backend-core local vocab cache", async () => {
        const { getMobileBriefingWandWord } = await import("./briefing");
        const wandPayload = {
            vocab: { phonetic: "/audit/", meaning: "审计" },
            etymology: { mode: "ROOTS", memory_hook: "audire", data: { root: "aud" } },
            ai_insight: null,
        };

        lookupWandWordMock.mockResolvedValueOnce(wandPayload);

        await expect(getMobileBriefingWandWord("Audit")).resolves.toEqual(wandPayload);
        expect(lookupWandWordMock).toHaveBeenCalledWith("Audit");
    });

    it("loads history with scenario and status filters", async () => {
        const { getMobileBriefingHistory } = await import("./briefing");
        const historyPayload = {
            items: [{
                id: "article-new",
                title: "Finance memo",
                createdAt: "2026-04-23T10:00:00.000Z",
                scenario: "finance_group",
                status: "new",
                vocabPreview: "audit",
            }],
            availableScenarios: ["finance_group"],
        };

        getBriefingHistoryForUserMock.mockResolvedValueOnce(historyPayload);

        await expect(
            getMobileBriefingHistory("user-123", { scenario: "finance_group", status: "new" })
        ).resolves.toEqual(historyPayload);
        expect(getBriefingHistoryForUserMock).toHaveBeenCalledWith(
            "user-123",
            { scenario: "finance_group", status: "new" }
        );
    });

    it("deletes an owned article through the backend-core transaction boundary", async () => {
        const { deleteMobileBriefingArticle } = await import("./briefing");

        deleteBriefingArticleForUserMock.mockResolvedValueOnce({ success: true });

        await expect(deleteMobileBriefingArticle("user-123", "article-9")).resolves.toEqual({ success: true });
        expect(deleteBriefingArticleForUserMock).toHaveBeenCalledWith("user-123", "article-9");
    });
});
