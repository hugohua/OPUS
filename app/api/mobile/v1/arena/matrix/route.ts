import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileArenaMatrix } from "@/lib/mobile/arena";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    if (!domain) {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "domain is required"),
            { status: 400 }
        );
    }

    try {
        const payload = await getMobileArenaMatrix(domain, session.user.id);
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch {
        return mobileInternalErrorResponse();
    }
}
