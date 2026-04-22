import { beforeEach, describe, expect, it, vi } from "vitest";

const getWeaverIngredientsMock = vi.fn();

vi.mock("@/actions/weaver-selection", () => ({
    getWeaverIngredients: getWeaverIngredientsMock,
}));

vi.mock("@/lib/db", () => ({
    db: {
        article: {
            findFirst: vi.fn(),
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
});
