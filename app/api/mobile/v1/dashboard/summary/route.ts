import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileDashboardSummary } from "@/lib/mobile/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const summary = await getMobileDashboardSummary(session.user.id, session.user.name);
        return Response.json(createMobileSuccessEnvelope(summary));
    } catch {
        return mobileInternalErrorResponse();
    }
}
