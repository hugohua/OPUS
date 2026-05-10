import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
    getRadarDataRaw,
    getUserWeaknessesRaw,
} from "./radar";

vi.mock("@/lib/db", async () => {
    const { mockDeep } = await import("vitest-mock-extended");
    const mock = mockDeep<PrismaClient>();
    return { db: mock, prisma: mock };
});

vi.mock("server-only", () => ({}));

const mockDb = db as unknown as DeepMockProxy<PrismaClient>;

describe("diagnostics radar backend core", () => {
    beforeEach(() => {
        mockReset(mockDb);
        vi.clearAllMocks();
    });

    it("returns empty diagnostics when the user has no arena attempts", async () => {
        (mockDb.attemptRecord.findMany as any).mockResolvedValue([]);

        const result = await getRadarDataRaw("user-1");

        expect(result).toEqual({
            radarData: [],
            weakest: null,
            totalAttempts: 0,
        });
    });

    it("aggregates question type accuracy and total attempts", async () => {
        (mockDb.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: "COLLOCATION", isCorrect: true, responseTimeMs: 2000 },
            { questionType: "COLLOCATION", isCorrect: false, responseTimeMs: 5000 },
            { questionType: "COLLOCATION", isCorrect: true, responseTimeMs: 3000 },
            { questionType: "GRAMMAR", isCorrect: false, responseTimeMs: 4000 },
            { questionType: "GRAMMAR", isCorrect: false, responseTimeMs: 6000 },
        ]);

        const result = await getRadarDataRaw("user-1");

        expect(result.totalAttempts).toBe(5);
        expect(result.weakest).toMatchObject({
            questionType: "GRAMMAR",
            label: "基础语法",
            total: 2,
            correct: 0,
            accuracy: 0,
            avgResponseMs: 5000,
        });
        expect(result.radarData).toEqual([
            { subject: "基础语法", A: 0, fullMark: 100 },
            { subject: "词组搭配", A: 67, fullMark: 100 },
        ]);
    });

    it("falls back to the raw enum as label for unknown question types", async () => {
        (mockDb.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: "UNKNOWN_NEW_TYPE", isCorrect: true, responseTimeMs: 1000 },
        ]);

        const weaknesses = await getUserWeaknessesRaw("user-1");

        expect(weaknesses[0]).toMatchObject({
            questionType: "UNKNOWN_NEW_TYPE",
            label: "UNKNOWN_NEW_TYPE",
            accuracy: 100,
        });
    });
});
