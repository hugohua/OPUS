import { NextResponse } from "next/server";
import { AUTH_ERROR_CODES } from "@/lib/auth/shared";
import {
    createAuthErrorEnvelope,
    createMobileSuccessEnvelope,
    issueMobileSessionForUser,
    resolveMobileSessionFromBearer,
} from "@/lib/auth/mobile";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await resolveMobileSessionFromBearer(req.headers.get("authorization"));
        if (!session) {
            return NextResponse.json(
                createAuthErrorEnvelope({
                    code: AUTH_ERROR_CODES.UNAUTHORIZED,
                    message: "Unauthorized",
                }),
                { status: 401 }
            );
        }

        const renewed = await issueMobileSessionForUser(session.user);
        return NextResponse.json(createMobileSuccessEnvelope(renewed));
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
