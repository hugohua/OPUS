import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { submitMobileSessionOutcome } from "@/lib/mobile/session";
import { RatingSchema, SessionModeSchema } from "@/lib/validations/briefing";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MobileSessionOutcomeBodySchema = z.object({
    vocabId: z.number().int(),
    grade: RatingSchema,
    mode: SessionModeSchema,
    track: z.enum(["VISUAL", "AUDIO", "CONTEXT"]).optional(),
    duration: z.number().int().nonnegative().optional(),
    isRetry: z.boolean().optional(),
    contextSentence: z.string().optional(),
});

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

    const validated = MobileSessionOutcomeBodySchema.safeParse(json);
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
        const result = await submitMobileSessionOutcome(validated.data, session.user.id);
        if (result.status === "error") {
            return Response.json(
                createMobileErrorEnvelope("INTERNAL_ERROR", result.message, result.fieldErrors),
                { status: 500 }
            );
        }

        return Response.json(createMobileSuccessEnvelope(result.data));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
