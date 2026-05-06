/**
 * Weaver Wand 共享核心测试
 * 功能：
 *   固定查词和分析流入口，避免 mobile adapter 直接访问 Prisma/AI SDK。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const vocabFindFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
    db: {
        vocab: { findFirst: vocabFindFirstMock },
    },
}));

describe("weaver wand core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("looks up words from the local vocab cache", async () => {
        const { lookupWandWord } = await import("../wand");

        vocabFindFirstMock.mockResolvedValueOnce({
            phoneticUk: "/audit/",
            definition_cn: "审计",
            etymology: { mode: "ROOTS", memory_hook: "audire", data: { root: "aud" } },
        });

        await expect(lookupWandWord("Audit")).resolves.toEqual({
            vocab: { phonetic: "/audit/", meaning: "审计" },
            etymology: { mode: "ROOTS", memory_hook: "audire", data: { root: "aud" } },
            ai_insight: null,
        });
    });
});
