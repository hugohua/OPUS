import { NextResponse } from "next/server";
import {
    AUTH_ERROR_CODES,
    authenticateUserByCredentials,
    validateLoginInput,
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
        const validated = validateLoginInput(payload);
        if (!validated.ok) {
            return jsonError(
                validated.error.code,
                validated.error.message,
                400,
                validated.error.fieldErrors
            );
        }

        const user = await authenticateUserByCredentials(validated.data);
        if (!user) {
            return jsonError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, "Invalid email or password", 401);
        }

        const session = await issueMobileSessionForUser(user);
        return NextResponse.json(createMobileSuccessEnvelope(session));
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
