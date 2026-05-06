/**
 * Arena Dashboard 共享核心测试
 * 功能：
 *   固定语法雷达、薄弱节点和矩阵查询的 Web 合同行为，供 Web 与 iOS 共用。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const userGrammarFindManyMock = vi.fn();
const grammarFindUniqueMock = vi.fn();
const grammarFindManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
    prisma: {
        userGrammarProficiency: { findMany: userGrammarFindManyMock },
        grammarNode: {
            findUnique: grammarFindUniqueMock,
            findMany: grammarFindManyMock,
        },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        child: () => ({
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        }),
    },
}));

describe("arena dashboard core", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("builds overview from radar domains and weakest L3 nodes", async () => {
        const { getArenaOverviewForUser } = await import("../dashboard");

        userGrammarFindManyMock.mockImplementation(async (args) => {
            if (args.where.grammarNode?.level === 1) {
                return [
                    { masteryScore: 0.8, grammarNode: { code: "L1_VERBS" } },
                ];
            }
            return [
                {
                    masteryScore: 0.2,
                    grammarNode: { id: "g1", name: "时态", description: "动词时态" },
                },
            ];
        });

        const result = await getArenaOverviewForUser("user-1");

        expect(result.radar).toHaveLength(5);
        expect(result.radar[0]).toEqual({ code: "L1_VERBS", label: "动词逻辑", score: 80 });
        expect(result.weakNodes).toEqual([
            { id: "g1", name: "时态", description: "动词时态", score: 20 },
        ]);
    });

    it("builds syntax matrix with default mastery for untested knots", async () => {
        const { getArenaMatrixForUser } = await import("../dashboard");

        grammarFindUniqueMock.mockResolvedValueOnce({
            code: "L1_VERBS",
            name: "动词",
            nameEn: "Verbs",
        });
        grammarFindManyMock.mockResolvedValueOnce([
            {
                id: "l3-1",
                name: "现在完成时",
                nameEn: "Present Perfect",
                parent: { id: "l2-1", name: "时态", nameEn: "Tense", sortOrder: 1 },
                _count: { questions: 3 },
            },
        ]);
        userGrammarFindManyMock.mockResolvedValueOnce([]);

        await expect(getArenaMatrixForUser("user-1", "L1_VERBS")).resolves.toEqual({
            l1Node: { code: "L1_VERBS", name: "Verbs" },
            categories: [
                {
                    l2Node: { id: "l2-1", name: "时态", nameEn: "Tense" },
                    knots: [
                        {
                            id: "l3-1",
                            name: "现在完成时",
                            nameEn: "Present Perfect",
                            shortCode: "PP",
                            masteryScore: 50,
                            availableQs: 3,
                        },
                    ],
                },
            ],
        });
    });
});
