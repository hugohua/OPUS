import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
    validateLoginInput: vi.fn(),
    validateRegisterInput: vi.fn(),
    authenticateUserByCredentials: vi.fn(),
    registerUserWithInviteCode: vi.fn(),
    issueMobileSessionForUser: vi.fn(),
    resolveMobileSessionFromBearer: vi.fn(),
}));

vi.mock("@/lib/auth/shared", () => ({
    AUTH_ERROR_CODES: {
        VALIDATION_ERROR: "VALIDATION_ERROR",
        INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
        INVALID_INVITE_CODE: "INVALID_INVITE_CODE",
        EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
        UNAUTHORIZED: "UNAUTHORIZED",
        INTERNAL_ERROR: "INTERNAL_ERROR",
    },
    validateLoginInput: mocks.validateLoginInput,
    validateRegisterInput: mocks.validateRegisterInput,
    authenticateUserByCredentials: mocks.authenticateUserByCredentials,
    registerUserWithInviteCode: mocks.registerUserWithInviteCode,
    getUserById: vi.fn(),
}));

vi.mock("@/lib/auth/mobile", () => ({
    createAuthErrorEnvelope: vi.fn((error) => ({
        status: "error",
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    })),
    createValidationErrorEnvelope: vi.fn((fieldErrors = {}) => ({
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        fieldErrors,
    })),
    createMobileSuccessEnvelope: vi.fn((data) => ({
        status: "success",
        data,
    })),
    issueMobileSessionForUser: mocks.issueMobileSessionForUser,
    resolveMobileSessionFromBearer: mocks.resolveMobileSessionFromBearer,
}));

import { POST as loginPOST } from "./login/route";
import { POST as registerPOST } from "./register/route";
import { POST as refreshPOST } from "./refresh/route";
import { POST as logoutPOST } from "./logout/route";
import { GET as meGET } from "./me/route";

type TestJsonResponse = Response & {
    body?: unknown;
    init?: ResponseInit;
};

async function readJson(response: Response) {
    const testResponse = response as TestJsonResponse;
    if (typeof testResponse.json === "function") {
        return testResponse.json();
    }

    return testResponse.body;
}

function readStatus(response: Response, defaultStatus = 200) {
    const testResponse = response as TestJsonResponse;
    return testResponse.status ?? testResponse.init?.status ?? defaultStatus;
}

describe("mobile auth routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.AUTH_SECRET = "test-secret";
    });

    it("logs in and returns a session envelope", async () => {
        mocks.validateLoginInput.mockReturnValue({
            ok: true,
            data: { email: "test@opus.dev", password: "secret" },
        });
        mocks.authenticateUserByCredentials.mockResolvedValue({
            id: "user-1",
            name: "Test User",
            email: "test@opus.dev",
        });
        mocks.issueMobileSessionForUser.mockResolvedValue({
            tokenType: "Bearer",
            accessToken: "token-1",
            expiresAt: "2026-05-21T00:00:00.000Z",
            user: {
                id: "user-1",
                name: "Test User",
                email: "test@opus.dev",
            },
        });

        const response = await loginPOST(new Request("http://localhost/api/mobile/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "test@opus.dev", password: "secret" }),
        }));

        expect(readStatus(response)).toBe(200);
        expect(await readJson(response)).toMatchObject({
            status: "success",
            data: {
                tokenType: "Bearer",
                accessToken: "token-1",
                user: {
                    id: "user-1",
                    name: "Test User",
                    email: "test@opus.dev",
                },
            },
        });
    });

    it("returns validation errors for login", async () => {
        mocks.validateLoginInput.mockReturnValue({
            ok: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                fieldErrors: { email: "Invalid email" },
            },
        });

        const response = await loginPOST(new Request("http://localhost/api/mobile/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "bad", password: "secret" }),
        }));

        expect(readStatus(response)).toBe(400);
        expect(await readJson(response)).toMatchObject({
            status: "error",
            code: "VALIDATION_ERROR",
            fieldErrors: { email: "Invalid email" },
        });
    });

    it("returns validation errors for malformed login JSON", async () => {
        const response = await loginPOST(new Request("http://localhost/api/mobile/v1/auth/login", {
            method: "POST",
            body: "{",
            headers: {
                "content-type": "application/json",
            },
        }));

        expect(readStatus(response)).toBe(400);
        expect(await readJson(response)).toMatchObject({
            status: "error",
            code: "VALIDATION_ERROR",
            message: "Validation failed",
        });
    });

    it("returns a generic internal error when login throws unexpectedly", async () => {
        mocks.validateLoginInput.mockReturnValue({
            ok: true,
            data: { email: "test@opus.dev", password: "secret" },
        });
        mocks.authenticateUserByCredentials.mockRejectedValue(new Error("database exploded"));

        const response = await loginPOST(new Request("http://localhost/api/mobile/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "test@opus.dev", password: "secret" }),
        }));

        expect(readStatus(response)).toBe(500);
        const body = await readJson(response);
        expect(body).toMatchObject({
            status: "error",
            code: "INTERNAL_ERROR",
            message: "Internal server error",
        });
        expect(JSON.stringify(body)).not.toContain("database exploded");
    });

    it("registers a user and auto-authenticates", async () => {
        mocks.validateRegisterInput.mockReturnValue({
            ok: true,
            data: {
                email: "new@opus.dev",
                password: "secret",
                name: "New User",
                inviteCode: "INVITE",
            },
        });
        mocks.registerUserWithInviteCode.mockResolvedValue({
            ok: true,
            user: {
                id: "user-2",
                name: "New User",
                email: "new@opus.dev",
            },
        });
        mocks.issueMobileSessionForUser.mockResolvedValue({
            tokenType: "Bearer",
            accessToken: "token-2",
            expiresAt: "2026-05-21T00:00:00.000Z",
            user: {
                id: "user-2",
                name: "New User",
                email: "new@opus.dev",
            },
        });

        const response = await registerPOST(new Request("http://localhost/api/mobile/v1/auth/register", {
            method: "POST",
            body: JSON.stringify({
                email: "new@opus.dev",
                password: "secret",
                name: "New User",
                inviteCode: "INVITE",
            }),
        }));

        expect(readStatus(response)).toBe(201);
        expect(await readJson(response)).toMatchObject({
            status: "success",
            data: {
                tokenType: "Bearer",
                accessToken: "token-2",
                user: {
                    id: "user-2",
                    name: "New User",
                    email: "new@opus.dev",
                },
            },
        });
    });

    it("returns unauthorized when refreshing without a bearer token", async () => {
        mocks.resolveMobileSessionFromBearer.mockResolvedValue(null);

        const response = await refreshPOST(new Request("http://localhost/api/mobile/v1/auth/refresh", {
            method: "POST",
        }));

        expect(readStatus(response)).toBe(401);
        expect(await readJson(response)).toMatchObject({
            status: "error",
            code: "UNAUTHORIZED",
        });
    });

    it("refreshes a valid bearer token", async () => {
        mocks.resolveMobileSessionFromBearer.mockResolvedValue({
            tokenType: "Bearer",
            accessToken: "token-old",
            expiresAt: "2026-05-21T00:00:00.000Z",
            user: {
                id: "user-4",
                name: "Refresh User",
                email: "refresh@opus.dev",
            },
        });
        mocks.issueMobileSessionForUser.mockResolvedValue({
            tokenType: "Bearer",
            accessToken: "token-new",
            expiresAt: "2026-06-21T00:00:00.000Z",
            user: {
                id: "user-4",
                name: "Refresh User",
                email: "refresh@opus.dev",
            },
        });

        const response = await refreshPOST(new Request("http://localhost/api/mobile/v1/auth/refresh", {
            method: "POST",
            headers: {
                authorization: "Bearer token-old",
            },
        }));

        expect(await readJson(response)).toMatchObject({
            status: "success",
            data: {
                tokenType: "Bearer",
                accessToken: "token-new",
                user: {
                    id: "user-4",
                    name: "Refresh User",
                    email: "refresh@opus.dev",
                },
            },
        });
    });

    it("returns the current session from me", async () => {
        mocks.resolveMobileSessionFromBearer.mockResolvedValue({
            tokenType: "Bearer",
            accessToken: "token-3",
            expiresAt: "2026-05-21T00:00:00.000Z",
            user: {
                id: "user-3",
                name: "Session User",
                email: "session@opus.dev",
            },
        });

        const response = await meGET(new Request("http://localhost/api/mobile/v1/auth/me", {
            method: "GET",
            headers: {
                authorization: "Bearer token-3",
            },
        }));

        expect(await readJson(response)).toMatchObject({
            status: "success",
            data: {
                tokenType: "Bearer",
                accessToken: "token-3",
                user: {
                    id: "user-3",
                    name: "Session User",
                    email: "session@opus.dev",
                },
            },
        });
    });

    it("logout is idempotent", async () => {
        const response = await logoutPOST();

        expect(await readJson(response)).toEqual({ status: "success" });
    });
});
