/**
 * Session Batch 共享核心测试
 * 功能：
 *   固定 Web 端批量取题入口，确保 Web Action、H5、iOS API 共用同一组卡核心。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefingPayload } from "@/types/briefing";

vi.mock("@/lib/services/omps-core", () => ({
    fetchOMPSCandidates: vi.fn(),
}));

vi.mock("@/lib/core/inventory", () => ({
    inventory: {
        popDrillBatch: vi.fn(),
        triggerBatchEmergency: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/lib/templates/phrase-fallback", () => ({
    buildPhraseFallbackDrill: vi.fn(),
}));

vi.mock("@/lib/templates/deterministic-drill", () => ({
    buildChunkingDrillFallback: vi.fn(),
}));

vi.mock("@/lib/templates/arena-fallback", () => ({
    buildArenaFallbackDrill: vi.fn(),
}));

vi.mock("@/lib/services/audit-service", () => ({
    auditSessionFallback: vi.fn(),
    auditInventoryEvent: vi.fn(),
    auditMixedModeDistribution: vi.fn(),
}));

vi.mock("@/lib/backend-core/settings/preferences", () => ({
    getEnginePreferencesByUserId: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
    db: {
        attemptRecord: { findMany: vi.fn() },
        questionSeed: { findMany: vi.fn(), updateMany: vi.fn() },
    },
    prisma: {},
}));

vi.mock("@/lib/logger", () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock("server-only", () => ({}));

const TEST_USER_ID = "cm66x5x5x000008l4am90956r";

function createCandidate(id: number, word = `word-${id}`) {
    return {
        vocabId: id,
        word,
        definition_cn: `定义-${id}`,
        definitions: { business_cn: `商务-${id}` },
        commonExample: `Example for ${word}`,
        phoneticUk: "/UK/",
        phoneticUs: "/US/",
        partOfSpeech: "n",
        word_family: {},
        priority_level: 1,
        frequency_score: 100,
        etymology: null,
        collocations: {},
        type: "NEW" as const,
        confusion_audio: [],
    };
}

function createCachedDrill(vocabId: number): BriefingPayload {
    return {
        meta: {
            format: "chat",
            target_word: `word-${vocabId}`,
            mode: "SYNTAX",
            batch_size: 10,
            sys_prompt_version: "v2.0",
        },
        segments: [
            { type: "text", content_markdown: "Cached content." },
        ],
    };
}

describe("getSessionDrillBatchForUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns an empty successful batch when OMPS has no candidates", async () => {
        const { fetchOMPSCandidates } = await import("@/lib/services/omps-core");
        const { getSessionDrillBatchForUser } = await import("../batch");
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        const result = await getSessionDrillBatchForUser({
            userId: TEST_USER_ID,
            mode: "SYNTAX",
        });

        expect(result).toMatchObject({
            status: "success",
            message: "No candidates found",
            data: [],
        });
    });

    it("returns cached drills with Web payload semantics", async () => {
        const { fetchOMPSCandidates } = await import("@/lib/services/omps-core");
        const { inventory } = await import("@/lib/core/inventory");
        const { getSessionDrillBatchForUser } = await import("../batch");

        vi.mocked(fetchOMPSCandidates).mockResolvedValue([createCandidate(1)]);
        vi.mocked(inventory.popDrillBatch).mockResolvedValue({ 1: createCachedDrill(1) });

        const result = await getSessionDrillBatchForUser({
            userId: TEST_USER_ID,
            mode: "SYNTAX",
            limit: 1,
        });

        expect(result.status).toBe("success");
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0].meta).toMatchObject({
            vocabId: 1,
            source: "cache_v2",
        });
    });
});
