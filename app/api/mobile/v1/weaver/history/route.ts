import {
    createMobileErrorEnvelope,
    createMobileSuccessEnvelope,
    mobileInternalErrorResponse,
    mobileUnauthorizedResponse,
    requireMobileSession,
} from "@/lib/mobile/contracts";
import { getMobileBriefingHistory } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const scenario = searchParams.get("scenario")?.trim();

    if (status && status !== "new" && status !== "archived") {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "status must be `new` or `archived`"),
            { status: 400 }
        );
    }

    try {
        const history = await getMobileBriefingHistory(session.user.id, {
            scenario: scenario || undefined,
            status: status as "new" | "archived" | undefined,
        });
        return Response.json(createMobileSuccessEnvelope(history));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
