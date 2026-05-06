/**
 * Weaver Selection 共享核心测试
 * 功能：
 *   固定选词核心的 cache-first 行为，避免 Web Action 成为共享服务层。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisGetMock = vi.fn();
const redisSetexMock = vi.fn();

vi.mock("@/lib/queue/connection", () => ({
    redis: {
        get: redisGetMock,
        setex: redisSetexMock,
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        userProgress: { findMany: vi.fn() },
        vocab: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/services/audit-service", () => ({
    auditWeaverSelection: vi.fn(),
}));

describe("weaver selection core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns cached ingredients without requiring auth", async () => {
        const { getWeaverIngredientsForUser } = await import("../selection");

        redisGetMock.mockResolvedValueOnce(JSON.stringify({
            priorityWords: [{ id: 1, word: "audit", meaning: "审计", source: "due_matched" }],
            fillerWords: [],
        }));

        await expect(getWeaverIngredientsForUser("user-1", "finance_group")).resolves.toMatchObject({
            status: "success",
            message: "Loaded from cache",
            data: {
                priorityWords: [{ id: 1, word: "audit", meaning: "审计", source: "due_matched" }],
                fillerWords: [],
            },
        });
        expect(redisSetexMock).not.toHaveBeenCalled();
    });
});
