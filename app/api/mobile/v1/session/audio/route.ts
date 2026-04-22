import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileAudioAvailability } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const payload = await getMobileAudioAvailability(session.user.id);
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch {
        return mobileInternalErrorResponse();
    }
}
