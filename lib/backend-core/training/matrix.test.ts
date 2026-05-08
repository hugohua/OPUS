import { describe, expect, it } from "vitest";

import { buildTrainingMatrix } from "./matrix";

describe("training matrix core", () => {
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
});
