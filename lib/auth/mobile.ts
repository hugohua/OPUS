import "server-only";

import { decode, encode } from "@auth/core/jwt";
import { NextResponse } from "next/server";
import { getUserById, type AuthFailure, type AuthUser, AUTH_ERROR_CODES } from "./shared";

export const MOBILE_AUTH_SALT = "opus-mobile-auth";
export const MOBILE_AUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type MobileJWT = {
    sub?: string;
    name?: string | null;
    email?: string | null;
    iat?: number;
    exp?: number;
};

export type MobileSessionData = {
    tokenType: "Bearer";
    accessToken: string;
    expiresAt: string;
    user: AuthUser;
};

export type MobileSuccessEnvelope = {
    status: "success";
    data: MobileSessionData;
};

export type MobileErrorEnvelope = {
    status: "error";
    code: AuthFailure["code"];
    message: string;
    fieldErrors?: Record<string, string>;
};

function getAuthSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error("AUTH_SECRET is required");
    }

    return secret;
}

function buildExpiresAt(exp: number): string {
    return new Date(exp * 1000).toISOString();
}

export function createMobileSuccessEnvelope(session: MobileSessionData): MobileSuccessEnvelope {
    return {
        status: "success",
        data: session,
    };
}

export function createAuthErrorEnvelope(error: AuthFailure): MobileErrorEnvelope {
    return {
        status: "error",
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
}

export function createValidationErrorEnvelope(fieldErrors: Record<string, string>): MobileErrorEnvelope {
    return createAuthErrorEnvelope({
        code: AUTH_ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        fieldErrors,
    });
}

function parseBearerToken(authorizationHeader: string | null): string | null {
    if (!authorizationHeader) {
        return null;
    }

    const parts = authorizationHeader.split(" ");
    if (parts.length !== 2) {
        return null;
    }

    const [scheme, token] = parts;
    if (scheme !== "Bearer" || !token) {
        return null;
    }

    try {
        return decodeURIComponent(token);
    } catch {
        return null;
    }
}

export async function issueMobileSessionForUser(user: AuthUser): Promise<MobileSessionData> {
    const secret = getAuthSecret();
    const accessToken = await encode({
        token: {
            sub: user.id,
            name: user.name,
            email: user.email,
        },
        secret,
        salt: MOBILE_AUTH_SALT,
        maxAge: MOBILE_AUTH_MAX_AGE_SECONDS,
    });

    const expiresAt = new Date(Date.now() + MOBILE_AUTH_MAX_AGE_SECONDS * 1000).toISOString();

    return {
        tokenType: "Bearer",
        accessToken,
        expiresAt,
        user,
    };
}

export async function resolveMobileSessionFromBearer(
    authorizationHeader: string | null
): Promise<MobileSessionData | null> {
    const accessToken = parseBearerToken(authorizationHeader);
    if (!accessToken) {
        return null;
    }

    const secret = getAuthSecret();
    let payload: MobileJWT | null;
    try {
        payload = await decode<MobileJWT>({
            token: accessToken,
            secret,
            salt: MOBILE_AUTH_SALT,
        });
    } catch {
        return null;
    }

    if (!payload?.sub || !payload.exp) {
        return null;
    }

    const user = await getUserById(payload.sub);
    if (!user) {
        return null;
    }

    return {
        tokenType: "Bearer",
        accessToken,
        expiresAt: buildExpiresAt(payload.exp),
        user,
    };
}

export function mobileInternalErrorResponse() {
    return NextResponse.json(
        createAuthErrorEnvelope({
            code: AUTH_ERROR_CODES.INTERNAL_ERROR,
            message: "Internal server error",
        }),
        { status: 500 }
    );
}
