import { describe, expect, it } from "vitest";

import packageJson from "@/package.json";
import { GET } from "./route";

type TestJsonResponse = Response & {
    body?: unknown;
};

async function readJson(response: Response) {
    const testResponse = response as TestJsonResponse;
    if (typeof testResponse.json === "function") {
        return testResponse.json();
    }

    return testResponse.body;
}

describe("GET /api/mobile/v1/health", () => {
    it("returns the mobile health payload contract", async () => {
        const response = await GET();
        const body = await readJson(response);

        expect(body).toMatchObject({
            status: "ok",
            env: process.env.NODE_ENV ?? "development",
            version: packageJson.version,
        });
        expect(Date.parse(body.timestamp)).not.toBeNaN();
    });
});
