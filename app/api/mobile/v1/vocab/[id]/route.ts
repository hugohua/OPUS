import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileVocabDetail } from "@/lib/mobile/vocabulary";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const { id } = await context.params;
        const payload = await getMobileVocabDetail(id, session.user.id);
        if (!payload) {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", "Vocab not found"),
                { status: 404 }
            );
        }
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch {
        return mobileInternalErrorResponse();
    }
}
