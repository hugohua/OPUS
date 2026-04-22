import { vi } from "vitest";

vi.mock("@/lib/mobile/contracts", async () => {
    return {
        createMobileSuccessEnvelope: (data: unknown) => ({ status: "success", data }),
        createMobileErrorEnvelope: (code: string, message: string, fieldErrors?: Record<string, string>) => ({
            status: "error",
            code,
            message,
            ...(fieldErrors ? { fieldErrors } : {}),
        }),
        mobileUnauthorizedResponse: () => Response.json({ status: "error", code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 }),
        mobileInternalErrorResponse: (message = "Internal server error") => Response.json({ status: "error", code: "INTERNAL_ERROR", message }, { status: 500 }),
        requireMobileSession: vi.fn(async () => ({
            tokenType: "Bearer",
            accessToken: "token",
            expiresAt: "2026-04-22T00:00:00.000Z",
            user: { id: "user-1", name: "Hugo", email: "hugo@example.com" },
        })),
    };
});

vi.mock("@/lib/mobile/dashboard", () => ({
    getMobileDashboardSummary: vi.fn(async () => ({ primaryTask: { mode: "DAILY_BLITZ" } })),
}));

vi.mock("@/lib/mobile/session", () => ({
    getMobileAudioAvailability: vi.fn(async () => ({ key: "audio", available: true, count: 2, items: [] })),
    getMobileReviewCards: vi.fn(async () => ([{ id: 1, word: "audit" }])),
}));

vi.mock("@/lib/mobile/arena", () => ({
    getMobileArenaOverview: vi.fn(async () => ({ radar: [], weakNodes: [] })),
    getMobileArenaMatrix: vi.fn(async () => ({ l1Node: { code: "L1_VERBS", name: "Verbs" }, categories: [] })),
}));

vi.mock("@/lib/mobile/vocabulary", () => ({
    getMobileVocabList: vi.fn(async () => ({ items: [], metadata: { total: 0, page: 1, totalPages: 0, hasMore: false, stats: { mastered: 0, learning: 0, due: 0, totalVocab: 0 } } })),
    getMobileVocabDetail: vi.fn(async () => ({ vocab: { id: 1, word: "audit" } })),
    getMobileVocabTags: vi.fn(async () => (["finance", "office"])),
}));

vi.mock("@/lib/mobile/briefing", () => ({
    getMobileLatestBriefing: vi.fn(async () => ({ id: "article-1", title: "Latest", content: "Body" })),
    getMobileBriefingIngredients: vi.fn(async () => ({ scenario: "finance_group", priorityWords: [], fillerWords: [] })),
}));

describe("mobile route contracts", () => {
    it("returns dashboard summary success envelope", async () => {
        const { GET } = await import("./dashboard/summary/route");
        const response = await GET(new Request("http://localhost/api/mobile/v1/dashboard/summary"));
        expect(await response.json()).toEqual({
            status: "success",
            data: { primaryTask: { mode: "DAILY_BLITZ" } },
        });
    });

    it("returns session success payloads", async () => {
        const audioRoute = await import("./session/audio/route");
        const cardsRoute = await import("./session/review-cards/route");

        expect(await (await audioRoute.GET(new Request("http://localhost/api/mobile/v1/session/audio"))).json()).toMatchObject({
            status: "success",
            data: { key: "audio", available: true, count: 2 },
        });
        expect(await (await cardsRoute.GET(new Request("http://localhost/api/mobile/v1/session/review-cards"))).json()).toMatchObject({
            status: "success",
            data: { count: 1 },
        });
    });

    it("returns arena and vocabulary envelopes", async () => {
        const arenaOverviewRoute = await import("./arena/overview/route");
        const arenaMatrixRoute = await import("./arena/matrix/route");
        const vocabListRoute = await import("./vocab/list/route");
        const vocabDetailRoute = await import("./vocab/[id]/route");
        const vocabTagsRoute = await import("./vocab/tags/route");

        expect(await (await arenaOverviewRoute.GET(new Request("http://localhost/api/mobile/v1/arena/overview"))).json()).toMatchObject({
            status: "success",
        });
        expect(await (await arenaMatrixRoute.GET(new Request("http://localhost/api/mobile/v1/arena/matrix?domain=L1_VERBS"))).json()).toMatchObject({
            status: "success",
            data: { l1Node: { code: "L1_VERBS" } },
        });
        expect(await (await vocabListRoute.GET(new Request("http://localhost/api/mobile/v1/vocab/list"))).json()).toMatchObject({
            status: "success",
        });
        expect(await (await vocabDetailRoute.GET(new Request("http://localhost/api/mobile/v1/vocab/1"), { params: Promise.resolve({ id: "1" }) })).json()).toMatchObject({
            status: "success",
            data: { vocab: { id: 1 } },
        });
        expect(await (await vocabTagsRoute.GET(new Request("http://localhost/api/mobile/v1/vocab/tags"))).json()).toEqual({
            status: "success",
            data: { tags: ["finance", "office"] },
        });
    });

    it("returns briefing metadata envelope", async () => {
        const latestRoute = await import("./weaver/latest/route");
        const ingredientsRoute = await import("./weaver/ingredients/route");

        expect(await (await latestRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/latest"))).json()).toEqual({
            status: "success",
            data: { id: "article-1", title: "Latest", content: "Body" },
        });
        expect(await (await ingredientsRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/ingredients?scenario=finance_group"))).json()).toMatchObject({
            status: "success",
            data: { scenario: "finance_group" },
        });
    });
});
