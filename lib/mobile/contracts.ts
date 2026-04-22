import { AUTH_ERROR_CODES, type AuthErrorCode } from "@/lib/auth/shared";
import { resolveMobileSessionFromBearer, type MobileSessionData } from "@/lib/auth/mobile";

export type MobileSuccessEnvelope<T> = {
    status: "success";
    data: T;
};

export type MobileErrorEnvelope = {
    status: "error";
    code: AuthErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
};

export function createMobileSuccessEnvelope<T>(data: T): MobileSuccessEnvelope<T> {
    return {
        status: "success",
        data,
    };
}

export function createMobileErrorEnvelope(
    code: AuthErrorCode,
    message: string,
    fieldErrors?: Record<string, string>
): MobileErrorEnvelope {
    return {
        status: "error",
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
    };
}

export function mobileUnauthorizedResponse(message = "Unauthorized"): Response {
    return Response.json(
        createMobileErrorEnvelope(AUTH_ERROR_CODES.UNAUTHORIZED, message),
        { status: 401 }
    );
}

export function mobileInternalErrorResponse(message = "Internal server error"): Response {
    return Response.json(
        createMobileErrorEnvelope(AUTH_ERROR_CODES.INTERNAL_ERROR, message),
        { status: 500 }
    );
}

export async function requireMobileSession(request: Request): Promise<MobileSessionData | null> {
    return resolveMobileSessionFromBearer(request.headers.get("authorization"));
}
