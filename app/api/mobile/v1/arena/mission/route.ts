import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileArenaMission } from "@/lib/mobile/arena";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const payload = await getMobileArenaMission(session.user);
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
