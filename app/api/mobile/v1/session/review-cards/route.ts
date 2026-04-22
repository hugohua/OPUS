import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileReviewCards } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get("limit") ?? "20");
        const items = await getMobileReviewCards(Number.isFinite(limit) ? limit : 20, session.user.id);
        return Response.json(createMobileSuccessEnvelope({
            items,
            count: items.length,
        }));
    } catch {
        return mobileInternalErrorResponse();
    }
}
