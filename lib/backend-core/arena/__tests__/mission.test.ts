/**
 * Arena Mission 共享核心测试
 * 功能：
 *   固定 Part 6 Mission 的 O(1) 消费、缓存兜底与审计行为。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOMPSCandidatesMock = vi.fn();
const popDrillBatchMock = vi.fn();
const triggerBatchEmergencyMock = vi.fn();
const buildArenaPart6FallbackDrillMock = vi.fn();
const auditInventoryEventMock = vi.fn();
const auditSessionFallbackMock = vi.fn();
const shuffleBriefingOptionsMock = vi.fn((drill) => drill);

vi.mock("@/lib/services/omps-core", () => ({
    fetchOMPSCandidates: fetchOMPSCandidatesMock,
}));

vi.mock("@/lib/core/inventory", () => ({
    inventory: {
        popDrillBatch: popDrillBatchMock,
        triggerBatchEmergency: triggerBatchEmergencyMock,
    },
}));

vi.mock("@/lib/templates/arena-fallback", () => ({
    buildArenaPart6FallbackDrill: buildArenaPart6FallbackDrillMock,
}));

vi.mock("@/lib/services/audit-service", () => ({
    auditInventoryEvent: auditInventoryEventMock,
    auditSessionFallback: auditSessionFallbackMock,
}));

vi.mock("@/lib/core/shuffle-options", () => ({
    shuffleBriefingOptions: shuffleBriefingOptionsMock,
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    },
}));

describe("arena mission core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        triggerBatchEmergencyMock.mockResolvedValue(undefined);
    });

    it("returns cached Part 6 drills and marks source metadata", async () => {
        const { generateArenaMissionForUser } = await import("../mission");

        fetchOMPSCandidatesMock.mockResolvedValueOnce([{ vocabId: 7, word: "audit" }]);
        popDrillBatchMock.mockResolvedValueOnce({
            7: { meta: { mode: "ARENA_PART6" }, segments: [] },
        });

        const result = await generateArenaMissionForUser("user-1");

        expect(result.meta).toMatchObject({ source: "cache_v2", vocabId: 7 });
        expect(auditInventoryEventMock).toHaveBeenCalledWith(
            "user-1",
            "CONSUME",
            "ARENA_PART6",
            expect.objectContaining({ vocabId: 7, delta: -1 })
        );
    });

    it("uses deterministic fallback and schedules replenishment when cache misses", async () => {
        const { generateArenaMissionForUser } = await import("../mission");

        fetchOMPSCandidatesMock.mockResolvedValueOnce([{ vocabId: 9, word: "budget" }]);
        popDrillBatchMock.mockResolvedValueOnce({});
        buildArenaPart6FallbackDrillMock.mockResolvedValueOnce({
            meta: { mode: "ARENA_PART6" },
            segments: [],
        });

        const result = await generateArenaMissionForUser("user-1");

        expect(result.meta).toMatchObject({ source: "deterministic_fallback", vocabId: 9 });
        expect(auditSessionFallbackMock).toHaveBeenCalledWith("user-1", "ARENA_PART6", 9, "budget");
        expect(triggerBatchEmergencyMock).toHaveBeenCalledWith("user-1", "ARENA_PART6", [9]);
    });
});
