import { beforeEach, describe, expect, it, vi } from "vitest";

const { progressFindManyMock } = vi.hoisted(() => ({
    progressFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    db: {
        userProgress: {
            findMany: progressFindManyMock,
        },
    },
}));

import { buildTrainingMatrix } from "./matrix";
import { buildTrainingMatrixForUser } from "./matrix-status";

describe("training matrix core", () => {
    beforeEach(() => {
        progressFindManyMock.mockReset();
    });

    it("returns the Web simulate matrix as the cross-client contract", () => {
        const matrix = buildTrainingMatrix();

        expect(matrix.sections.map((section) => section.id)).toEqual([
            "diagnostics",
            "arena",
            "l0",
            "l1",
            "l2",
            "l3",
        ]);

        expect(matrix.sections.flatMap((section) => section.entries.map((entry) => entry.id))).toEqual([
            "diagnostic-radar",
            "arena-blitz",
            "arena-mission",
            "l0-syntax",
            "l0-phrase",
            "l0-blitz",
            "l1-audio",
            "l1-chunking",
            "l2-context",
            "l2-nuance",
            "l3-weaver",
            "l3-history",
        ]);
    });

    it("does not expose static queue counts in the cross-client shell", () => {
        const entries = buildTrainingMatrix().sections.flatMap((section) => section.entries);

        expect(entries.map((entry) => entry.queue)).toEqual(entries.map(() => undefined));
        expect(entries.map((entry) => entry.count)).toEqual(entries.map(() => undefined));
        expect(entries.map((entry) => entry.statusLabel)).toEqual(entries.map(() => undefined));
        expect(JSON.stringify(buildTrainingMatrix())).not.toMatch(/队列:\s*\d+/);
        expect(JSON.stringify(buildTrainingMatrix())).not.toMatch(/个待练习/);
    });

    it("keeps destination contracts explicit for Web and iOS adapters", () => {
        const entries = buildTrainingMatrix().sections.flatMap((section) => section.entries);

        expect(entries.find((entry) => entry.id === "arena-blitz")?.destination).toEqual({
            kind: "arena",
            value: "part5",
        });
        expect(entries.find((entry) => entry.id === "l0-syntax")?.destination).toEqual({
            kind: "training",
            value: "SYNTAX",
        });
        expect(entries.find((entry) => entry.id === "l3-history")?.destination).toEqual({
            kind: "briefing",
            value: "history",
        });
    });

    it("builds user-specific dynamic training counts at track level", async () => {
        const now = new Date("2026-05-08T00:00:00.000Z");
        progressFindManyMock.mockImplementation(async ({ where }) => {
            switch (where.track) {
                case "VISUAL":
                    return [
                        { stability: 3 },
                        { stability: 10 },
                        { stability: 30 },
                    ];
                case "AUDIO":
                    return [
                        { stability: 8 },
                        { stability: 20 },
                    ];
                case "CONTEXT":
                    return [
                        { stability: 12 },
                        { stability: 60 },
                    ];
                default:
                    return [];
            }
        });

        const matrix = await buildTrainingMatrixForUser("user-1", now);
        const entries = Object.fromEntries(
            matrix.sections.flatMap((section) => section.entries).map((entry) => [entry.id, entry])
        );

        expect(entries["l0-syntax"]).toMatchObject({ count: 3, statusLabel: "可练: 3", availability: "ready" });
        expect(entries["l0-phrase"]).toMatchObject({ count: 3, statusLabel: "可练: 3", availability: "ready" });
        expect(entries["l0-blitz"]).toMatchObject({ count: 3, statusLabel: "可练: 3", availability: "ready" });
        expect(entries["l1-audio"]).toMatchObject({ count: 2, statusLabel: "可练: 2", availability: "ready" });
        expect(entries["l1-chunking"]).toMatchObject({ count: 2, statusLabel: "可练: 2", availability: "ready" });
        expect(entries["l2-context"]).toMatchObject({ count: 2, statusLabel: "可练: 2", availability: "ready" });
        expect(entries["l2-nuance"]).toMatchObject({ count: 2, statusLabel: "可练: 2", availability: "ready" });
        expect(entries["arena-blitz"].count).toBeUndefined();
        expect(entries["l3-weaver"].statusLabel).toBeUndefined();

        expect(progressFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: "user-1",
                track: "VISUAL",
                OR: [
                    { status: "NEW" },
                    { status: { in: ["LEARNING", "REVIEW"] }, next_review_at: { lte: now } },
                ],
            }),
        }));
    });
});
