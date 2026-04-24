import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileBriefingWandWord } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const word = searchParams.get("word")?.trim();
    if (!word) {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "word is required"),
            { status: 400 }
        );
    }

    try {
        const payload = await getMobileBriefingWandWord(word);
        if (!payload) {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", "Word not found"),
                { status: 404 }
            );
        }

        return Response.json(createMobileSuccessEnvelope(payload));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
