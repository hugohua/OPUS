import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", async () => {
    const { mockDeep } = await import("vitest-mock-extended");
    return {
        db: mockDeep(),
    };
});

vi.mock("bcryptjs", () => ({
    default: {
        hash: vi.fn(async (value: string) => `hashed:${value}`),
        compare: vi.fn(async (value: string, hashed: string) => hashed === `hashed:${value}`),
    },
}));

import { db } from "@/lib/db";
import {
    AUTH_ERROR_CODES,
    authenticateUserByCredentials,
    registerUserWithInviteCode,
    validateLoginInput,
    validateRegisterInput,
} from "../shared";

const mockDb = db as unknown as DeepMockProxy<PrismaClient>;

describe("auth shared helpers", () => {
    beforeEach(() => {
        mockReset(mockDb);
        vi.clearAllMocks();
    });

    it("validates login input", () => {
        expect(validateLoginInput({ email: "test@opus.dev", password: "secret" }).ok).toBe(true);
        expect(validateLoginInput({ email: "bad", password: "secret" }).ok).toBe(false);
    });

    it("validates register input", () => {
        expect(
            validateRegisterInput({
                email: "test@opus.dev",
                password: "secret",
                name: "Test User",
                inviteCode: "INVITE",
            }).ok
        ).toBe(true);
    });

    it("authenticates an existing user", async () => {
        mockDb.user.findUnique.mockResolvedValue({
            id: "user-1",
            name: "Test User",
            email: "test@opus.dev",
            password: "hashed:secret",
        } as any);

        await expect(authenticateUserByCredentials({ email: "test@opus.dev", password: "secret" })).resolves.toEqual({
            id: "user-1",
            name: "Test User",
            email: "test@opus.dev",
        });
    });

    it("rejects invalid invite codes", async () => {
        mockDb.$transaction.mockImplementation(async (callback: any) => {
            return await callback({
                $queryRaw: vi.fn().mockResolvedValue([]),
                user: {
                    create: vi.fn(),
                },
            });
        });

        const result = await registerUserWithInviteCode({
            email: "new@opus.dev",
            password: "secret",
            name: "New User",
            inviteCode: "BAD",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe(AUTH_ERROR_CODES.INVALID_INVITE_CODE);
        }
    });

    it("creates a user and increments invite usage", async () => {
        mockDb.$transaction.mockImplementation(async (callback: any) => {
            return await callback({
                $queryRaw: vi.fn().mockResolvedValue([{ id: "invite-1" }]),
                user: {
                    create: vi.fn().mockResolvedValue({
                        id: "user-2",
                        name: "New User",
                        email: "new@opus.dev",
                    }),
                },
            });
        });

        const result = await registerUserWithInviteCode({
            email: "new@opus.dev",
            password: "secret",
            name: "New User",
            inviteCode: "INVITE",
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.user).toEqual({
                id: "user-2",
                name: "New User",
                email: "new@opus.dev",
            });
        }
    });
});
