import { NextResponse } from "next/server";
import {
    AUTH_ERROR_CODES,
    registerUserWithInviteCode,
    validateRegisterInput,
} from "@/lib/auth/shared";
import {
    createAuthErrorEnvelope,
    createMobileSuccessEnvelope,
    createValidationErrorEnvelope,
    issueMobileSessionForUser,
} from "@/lib/auth/mobile";

export const dynamic = "force-dynamic";

function jsonError(code: typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES], message: string, status: number, fieldErrors?: Record<string, string>) {
    return NextResponse.json(
        {
            status: "error",
            code,
            message,
            ...(fieldErrors ? { fieldErrors } : {}),
        },
        { status }
    );
}

export async function POST(req: Request) {
    let payload: unknown;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json(createValidationErrorEnvelope({}), { status: 400 });
    }

    try {
        const validated = validateRegisterInput(payload);
        if (!validated.ok) {
            return jsonError(
                validated.error.code,
                validated.error.message,
                400,
                validated.error.fieldErrors
            );
        }

        const result = await registerUserWithInviteCode(validated.data);
        if (!result.ok) {
            switch (result.error.code) {
                case AUTH_ERROR_CODES.INVALID_INVITE_CODE:
                    return jsonError(result.error.code, result.error.message, 400);
                case AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED:
                    return jsonError(result.error.code, result.error.message, 409);
                default:
                    return jsonError(result.error.code, result.error.message, 500);
            }
        }

        const session = await issueMobileSessionForUser(result.user);
        return NextResponse.json(createMobileSuccessEnvelope(session), { status: 201 });
    } catch {
        return NextResponse.json(
            createAuthErrorEnvelope({
                code: AUTH_ERROR_CODES.INTERNAL_ERROR,
                message: "Internal server error",
            }),
            { status: 500 }
        );
    }
}
