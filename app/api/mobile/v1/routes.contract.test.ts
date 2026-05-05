import { existsSync } from "node:fs";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const hasArenaMissionRoute = existsSync(new URL("./arena/mission/route.ts", import.meta.url));
const hasArenaAttemptRoute = existsSync(new URL("./arena/attempt/route.ts", import.meta.url));

vi.mock("server-only", () => ({}));

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
    getMobileSessionBatch: vi.fn(async () => ([{ meta: { vocabId: 1, mode: "SYNTAX" }, segments: [] }])),
    submitMobileSessionOutcome: vi.fn(async () => ({ status: "success", message: "Outcome recorded", data: { id: "progress-1" } })),
    submitMobileAudioGrade: vi.fn(async () => ({ status: "success", message: "Outcome recorded", data: { id: "progress-2" } })),
    MobileAudioGradeSchema: z.object({
        vocabId: z.number().int().positive(),
        grade: z.number().int().min(1).max(4),
        duration: z.number().int().nonnegative().optional(),
    }),
}));

vi.mock("@/lib/mobile/drive", () => ({
    getMobileDrivePlaylist: vi.fn(async (query: { mode?: string; track?: string; batch?: string }) => {
        if (query.mode === "UNKNOWN" || query.track === "UNKNOWN" || query.batch === "99") {
            throw new Error("Invalid drive playlist options");
        }

        return {
            items: [{ id: "drive-1", text: "audit", mode: "QUIZ" }],
            track: "VISUAL",
            mode: "SANDWICH",
            batchSize: 30,
        };
    }),
}));

vi.mock("@/lib/mobile/tts", () => ({
    generateMobileTTS: vi.fn(async () => ({
        url: "/audio/audit.wav",
        audioUrl: "http://localhost/audio/audit.wav",
        cached: true,
        hash: "audio-hash",
    })),
}));

vi.mock("@/lib/mobile/arena", () => ({
    getMobileArenaOverview: vi.fn(async () => ({ radar: [], weakNodes: [] })),
    getMobileArenaMatrix: vi.fn(async () => ({ l1Node: { code: "L1_VERBS", name: "Verbs" }, categories: [] })),
    getMobileArenaMission: vi.fn(async () => ({ meta: { format: "part6", part: 6 }, segments: [] })),
    recordMobileArenaAttempt: vi.fn(async () => ({ success: true, attemptId: "attempt-1" })),
}));

vi.mock("@/lib/mobile/vocabulary", () => ({
    getMobileVocabList: vi.fn(async () => ({ items: [], metadata: { total: 0, page: 1, totalPages: 0, hasMore: false, stats: { mastered: 0, learning: 0, due: 0, totalVocab: 0 } } })),
    getMobileVocabDetail: vi.fn(async () => ({ vocab: { id: 1, word: "audit" } })),
    getMobileVocabTags: vi.fn(async () => (["finance", "office"])),
}));

vi.mock("@/lib/mobile/briefing", () => ({
    getMobileLatestBriefing: vi.fn(async () => ({ id: "article-1", title: "Latest", content: "Body" })),
    getMobileBriefingIngredients: vi.fn(async () => ({ scenario: "finance_group", priorityWords: [], fillerWords: [] })),
    getMobileBriefingDetail: vi.fn(async () => ({
        id: "article-1",
        title: "Latest",
        scenario: "finance_group",
        density: "balanced",
        content: "Body",
        targetWords: [],
    })),
    getMobileBriefingHistory: vi.fn(async () => ({
        items: [
            {
                id: "article-1",
                title: "Latest",
                createdAt: "2026-04-23T00:00:00.000Z",
                scenario: "finance_group",
                status: "new",
                vocabPreview: "audit",
            },
        ],
        availableScenarios: ["finance_group"],
    })),
    deleteMobileBriefingArticle: vi.fn(async () => ({ success: true })),
    getMobileBriefingWandWord: vi.fn(async () => ({
        vocab: { phonetic: "/ˈɔːdɪt/", meaning: "审计" },
        etymology: null,
        ai_insight: null,
    })),
    createMobileBriefingWandAnalyzeStream: vi.fn(() => new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"type":"content","data":"chunk"}\n\n'));
            controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
            controller.close();
        },
    })),
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
        const batchRoute = await import("./session/batch/route");
        const outcomeRoute = await import("./session/outcome/route");
        const audioGradeRoute = await import("./session/audio/grade/route");
        const cardsRoute = await import("./session/review-cards/route");

        expect(await (await audioRoute.GET(new Request("http://localhost/api/mobile/v1/session/audio"))).json()).toMatchObject({
            status: "success",
            data: { key: "audio", available: true, count: 2 },
        });
        expect(await (await batchRoute.POST(new Request("http://localhost/api/mobile/v1/session/batch", {
            method: "POST",
            body: JSON.stringify({ mode: "SYNTAX", limit: 1 }),
        }))).json()).toMatchObject({
            status: "success",
            data: {
                count: 1,
                items: [{ meta: { vocabId: 1, mode: "SYNTAX" } }],
            },
        });
        expect(await (await outcomeRoute.POST(new Request("http://localhost/api/mobile/v1/session/outcome", {
            method: "POST",
            body: JSON.stringify({ vocabId: 1, grade: 3, mode: "SYNTAX" }),
        }))).json()).toMatchObject({
            status: "success",
            data: { id: "progress-1" },
        });
        expect(await (await audioGradeRoute.POST(new Request("http://localhost/api/mobile/v1/session/audio/grade", {
            method: "POST",
            body: JSON.stringify({ vocabId: 1, grade: 4 }),
        }))).json()).toMatchObject({
            status: "success",
            data: { id: "progress-2" },
        });
        expect(await (await cardsRoute.GET(new Request("http://localhost/api/mobile/v1/session/review-cards"))).json()).toMatchObject({
            status: "success",
            data: { count: 1 },
        });
    });

    it("returns drive playlist and mobile TTS envelopes", async () => {
        const driveRoute = await import("./drive/playlist/route");
        const ttsRoute = await import("./tts/generate/route");

        expect(await (await driveRoute.GET(new Request("http://localhost/api/mobile/v1/drive/playlist?mode=SANDWICH&track=VISUAL&batch=30"))).json()).toMatchObject({
            status: "success",
            data: {
                mode: "SANDWICH",
                track: "VISUAL",
                batchSize: 30,
                items: [{ id: "drive-1" }],
            },
        });
        expect(await (await ttsRoute.POST(new Request("http://localhost/api/mobile/v1/tts/generate", {
            method: "POST",
            body: JSON.stringify({ text: "audit", voice: "Kai", language: "en-US", speed: 0.9 }),
        }))).json()).toMatchObject({
            status: "success",
            data: {
                audioUrl: "http://localhost/audio/audit.wav",
                cached: true,
                hash: "audio-hash",
            },
        });
    });

    it.each([
        "mode=UNKNOWN&track=VISUAL&batch=30",
        "mode=SANDWICH&track=UNKNOWN&batch=30",
        "mode=SANDWICH&track=VISUAL&batch=99",
    ])("returns drive playlist validation errors for invalid query: %s", async (query: string) => {
        const driveRoute = await import("./drive/playlist/route");

        const response = await driveRoute.GET(new Request(`http://localhost/api/mobile/v1/drive/playlist?${query}`));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            status: "error",
            code: "VALIDATION_ERROR",
            message: "Invalid drive playlist options",
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

    (hasArenaMissionRoute ? it : it.skip)("returns arena mission envelopes when the route is present", async () => {
        const arenaMissionRoute = await import("./arena/mission/route");

        expect(await (await arenaMissionRoute.GET(new Request("http://localhost/api/mobile/v1/arena/mission"))).json()).toMatchObject({
            status: "success",
            data: { meta: { format: "part6", part: 6 } },
        });
    });

    (hasArenaAttemptRoute ? it : it.skip)("returns arena attempt envelopes and validates malformed json", async () => {
        const arenaAttemptRoute = await import("./arena/attempt/route");

        expect(await (await arenaAttemptRoute.POST(new Request("http://localhost/api/mobile/v1/arena/attempt", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                questionSeedId: "seed-1",
                anchorVocabId: 42,
                isCorrect: true,
                responseTimeMs: 800,
                selectedOption: "because",
                questionType: "GRAMMAR",
                part: 6,
            }),
        }))).json()).toEqual({
            status: "success",
            data: { success: true, attemptId: "attempt-1" },
        });

        const invalidJsonResponse = await arenaAttemptRoute.POST(new Request("http://localhost/api/mobile/v1/arena/attempt", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
        }));

        expect(invalidJsonResponse.status).toBe(400);
        expect(await invalidJsonResponse.json()).toEqual({
            status: "error",
            code: "VALIDATION_ERROR",
            message: "Invalid JSON body",
        });
    });

    it("returns briefing reader and history envelopes", async () => {
        const latestRoute = await import("./weaver/latest/route");
        const ingredientsRoute = await import("./weaver/ingredients/route");
        const detailRoute = await import("./weaver/[id]/route");
        const historyRoute = await import("./weaver/history/route");
        const wandWordRoute = await import("./weaver/wand/word/route");
        const wandAnalyzeRoute = await import("./weaver/wand/analyze/route");

        expect(await (await latestRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/latest"))).json()).toEqual({
            status: "success",
            data: { id: "article-1", title: "Latest", content: "Body" },
        });
        expect(await (await ingredientsRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/ingredients?scenario=finance_group"))).json()).toMatchObject({
            status: "success",
            data: { scenario: "finance_group" },
        });
        expect(await (await detailRoute.GET(
            new Request("http://localhost/api/mobile/v1/weaver/article-1"),
            { params: Promise.resolve({ id: "article-1" }) }
        )).json()).toMatchObject({
            status: "success",
            data: { id: "article-1", scenario: "finance_group" },
        });
        expect(await (await historyRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/history?status=new"))).json()).toMatchObject({
            status: "success",
            data: {
                items: [{ id: "article-1", status: "new" }],
                availableScenarios: ["finance_group"],
            },
        });
        expect(await (await wandWordRoute.GET(new Request("http://localhost/api/mobile/v1/weaver/wand/word?word=audit"))).json()).toMatchObject({
            status: "success",
            data: { vocab: { meaning: "审计" } },
        });
        expect(await (await detailRoute.DELETE(
            new Request("http://localhost/api/mobile/v1/weaver/article-1", { method: "DELETE" }),
            { params: Promise.resolve({ id: "article-1" }) }
        )).json()).toEqual({
            status: "success",
            data: { success: true },
        });

        const analyzeResponse = await wandAnalyzeRoute.POST(new Request("http://localhost/api/mobile/v1/weaver/wand/analyze", {
            method: "POST",
            body: JSON.stringify({ text: "audit", type: "word", context: "The audit starts today." }),
        }));

        expect(analyzeResponse.headers.get("Content-Type")).toContain("text/event-stream");
        await expect(analyzeResponse.text()).resolves.toContain('"type":"content"');
    });
});
