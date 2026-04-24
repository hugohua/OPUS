import {
    createMobileErrorEnvelope,
    createMobileSuccessEnvelope,
    mobileInternalErrorResponse,
    mobileUnauthorizedResponse,
    requireMobileSession,
} from "@/lib/mobile/contracts";
import { deleteMobileBriefingArticle, getMobileBriefingDetail } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { id } = await params;

    try {
        const article = await getMobileBriefingDetail(session.user.id, id);
        if (!article) {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", "Briefing article not found"),
                { status: 404 }
            );
        }

        return Response.json(createMobileSuccessEnvelope(article));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}

export async function DELETE(request: Request, { params }: RouteContext) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    const { id } = await params;

    try {
        const result = await deleteMobileBriefingArticle(session.user.id, id);
        if (!result) {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", "Briefing article not found"),
                { status: 404 }
            );
        }

        return Response.json(createMobileSuccessEnvelope(result));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
