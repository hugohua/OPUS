import packageJson from "@/package.json";
import { GET } from "./route";

describe("GET /api/mobile/v1/health", () => {
    it("returns the mobile health payload contract", async () => {
        const response = await GET();

        expect(response.body).toMatchObject({
            status: "ok",
            env: process.env.NODE_ENV ?? "development",
            version: packageJson.version,
        });
        expect(Date.parse(response.body.timestamp)).not.toBeNaN();
    });
});
