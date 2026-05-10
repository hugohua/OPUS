import { getRadarDataRaw } from "@/lib/backend-core/diagnostics/radar";
import {
    createMobileSuccessEnvelope,
    mobileInternalErrorResponse,
    mobileUnauthorizedResponse,
    requireMobileSession,
} from "@/lib/mobile/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        return Response.json(createMobileSuccessEnvelope(await getRadarDataRaw(session.user.id)));
    } catch {
        return mobileInternalErrorResponse();
    }
}
