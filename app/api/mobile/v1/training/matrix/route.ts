import { buildTrainingMatrix } from "@/lib/backend-core/training/matrix";
import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        return Response.json(createMobileSuccessEnvelope(buildTrainingMatrix()));
    } catch {
        return mobileInternalErrorResponse();
    }
}
