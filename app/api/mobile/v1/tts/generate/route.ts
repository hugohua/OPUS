import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { generateMobileTTS } from "@/lib/mobile/tts";

export const dynamic = "force-dynamic";

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

    try {
        const payload = await generateMobileTTS(json, request.url);
        return Response.json(createMobileSuccessEnvelope(payload));
    } catch (error) {
        if (error instanceof Error && error.name === "ZodError") {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", "Validation failed"),
                { status: 400 }
            );
        }

        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
