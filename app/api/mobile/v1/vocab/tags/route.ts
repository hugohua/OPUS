import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileVocabTags } from "@/lib/mobile/vocabulary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const tags = await getMobileVocabTags(session.user.id);
        return Response.json(createMobileSuccessEnvelope({ tags }));
    } catch {
        return mobileInternalErrorResponse();
    }
}
