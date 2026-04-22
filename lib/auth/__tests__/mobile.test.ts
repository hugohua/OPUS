import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", async () => {
    const { mockDeep } = await import("vitest-mock-extended");
    return {
        db: mockDeep(),
    };
});

import { db } from "@/lib/db";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
    issueMobileSessionForUser,
    resolveMobileSessionFromBearer,
    MOBILE_AUTH_MAX_AGE_SECONDS,
} from "../mobile";

const mockDb = db as unknown as DeepMockProxy<PrismaClient>;

describe("mobile auth helpers", () => {
    beforeEach(() => {
        mockReset(mockDb);
        vi.clearAllMocks();
        process.env.AUTH_SECRET = "test-secret";
    });

    it("issues and resolves a bearer session token", async () => {
        const before = Date.now();
        const issued = await issueMobileSessionForUser({
            id: "user-1",
            name: "Test User",
            email: "test@opus.dev",
        });

        mockDb.user.findUnique.mockResolvedValue({
            id: "user-1",
            name: "Test User",
            email: "test@opus.dev",
        } as any);

        const resolved = await resolveMobileSessionFromBearer(`Bearer ${issued.accessToken}`);

        expect(issued.tokenType).toBe("Bearer");
        expect(Date.parse(issued.expiresAt)).not.toBeNaN();
        const issuedExpiry = Date.parse(issued.expiresAt);
        expect(issuedExpiry).toBeGreaterThanOrEqual(before + MOBILE_AUTH_MAX_AGE_SECONDS * 1000 - 1000);
        expect(issuedExpiry).toBeLessThanOrEqual(Date.now() + MOBILE_AUTH_MAX_AGE_SECONDS * 1000 + 1000);
        expect(resolved).toMatchObject({
            tokenType: "Bearer",
            accessToken: issued.accessToken,
            user: {
                id: "user-1",
                name: "Test User",
                email: "test@opus.dev",
            },
        });
    });

    it("returns null for malformed authorization headers", async () => {
        await expect(resolveMobileSessionFromBearer("Bearer %E0%A4")).resolves.toBeNull();
    });

    it("returns null for invalid bearer tokens instead of throwing", async () => {
        await expect(resolveMobileSessionFromBearer("Bearer definitely-not-a-valid-token")).resolves.toBeNull();
    });
});
