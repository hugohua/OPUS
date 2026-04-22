import { createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileVocabList } from "@/lib/mobile/vocabulary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const { searchParams } = new URL(request.url);
        const payload = await getMobileVocabList({
            userId: session.user.id,
            page: Number(searchParams.get("page") ?? "1"),
            limit: Number(searchParams.get("limit") ?? "50"),
            search: searchParams.get("search") ?? "",
            status: searchParams.get("status") ?? "ALL",
            sort: searchParams.get("sort") ?? "RANK",
            tagFilter: searchParams.get("tagFilter") ?? undefined,
        });
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch {
        return mobileInternalErrorResponse();
    }
}
