/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FsrsHud } from "../fsrs-hud";

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: any) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("FsrsHud", () => {
    it("renders the telemetry score supplied by the backend summary", () => {
        render(
            <FsrsHud
                stats={{
                    mastered: 9,
                    learning: 52,
                    due: 48,
                    telemetryScoreText: "56% R",
                }}
            />
        );

        expect(screen.getByText("56% R")).toBeTruthy();
        expect(screen.queryByText("94% R")).toBeNull();
    });
});
