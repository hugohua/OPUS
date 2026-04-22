import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileBriefingIngredients } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get("scenario");
    if (!scenario) {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "scenario is required"),
            { status: 400 }
        );
    }

    try {
        const payload = await getMobileBriefingIngredients(
            session.user.id,
            scenario,
            searchParams.get("refresh") === "true"
        );
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
