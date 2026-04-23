import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileSessionBatch } from "@/lib/mobile/session";
import { GetBriefingSchema } from "@/lib/validations/briefing";

export const dynamic = "force-dynamic";

const MobileSessionBatchBodySchema = GetBriefingSchema.omit({ userId: true });

export async function POST(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    let json: unknown;
    try {
        json = await request.json();
    } catch {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "Invalid JSON body"),
            { status: 400 }
        );
    }

    const validated = MobileSessionBatchBodySchema.safeParse(json);
    if (!validated.success) {
        return Response.json(
            createMobileErrorEnvelope(
                "VALIDATION_ERROR",
                "Validation failed",
                Object.fromEntries(
                    Object.entries(validated.error.flatten().fieldErrors).map(([key, value]) => [key, value?.[0] ?? ""])
                )
            ),
            { status: 400 }
        );
    }

    try {
        const items = await getMobileSessionBatch(validated.data, session.user.id);
        return Response.json(createMobileSuccessEnvelope({
            items,
            count: items.length,
        }));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
