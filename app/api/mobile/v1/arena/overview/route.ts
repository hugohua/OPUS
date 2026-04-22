import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileArenaOverview } from "@/lib/mobile/arena";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const payload = await getMobileArenaOverview(session.user.id);
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch {
        return mobileInternalErrorResponse();
    }
}
