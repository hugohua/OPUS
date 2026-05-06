/**
 * Review Cards 共享核心测试
 * 功能：
 *   固定复习卡组来源，避免 mobile adapter 直接调用 app 层 Server Action。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchOMPSCandidatesMock = vi.fn();

vi.mock("@/lib/services/omps-core", () => ({
    fetchOMPSCandidates: fetchOMPSCandidatesMock,
}));

describe("review cards core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps OMPS candidates into WordAsset review cards", async () => {
        const { getReviewCardsForUser } = await import("../review-cards");

        fetchOMPSCandidatesMock.mockResolvedValueOnce([{
            vocabId: 1,
            word: "audit",
            phoneticUs: "/audit-us/",
            phoneticUk: "/audit-uk/",
            definition_cn: "审计",
            word_family: { children: [] },
            collocations: [{ text: "internal audit", trans: "内部审计" }],
        }]);

        await expect(getReviewCardsForUser("user-1", 20, [3])).resolves.toEqual([{
            id: 1,
            word: "audit",
            phonetic: "/audit-us/",
            meaning: "审计",
            word_family: { children: [] },
            collocations: [{ text: "internal audit", translation: "内部审计" }],
        }]);
        expect(fetchOMPSCandidatesMock).toHaveBeenCalledWith("user-1", 20, {}, [3]);
    });
});
