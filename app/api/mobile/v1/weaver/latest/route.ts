import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileLatestBriefing } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const briefing = await getMobileLatestBriefing(session.user.id);
        return Response.json(createMobileSuccessEnvelope(briefing));
    } catch {
        return mobileInternalErrorResponse();
    }
}
