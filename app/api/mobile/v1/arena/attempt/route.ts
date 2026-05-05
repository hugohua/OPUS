import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { recordMobileArenaAttempt } from "@/lib/mobile/arena";
import { QuestionType } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ArenaAttemptSchema = z.object({
    questionSeedId: z.string().optional(),
    anchorVocabId: z.number().nullable().optional(),
    isCorrect: z.boolean(),
    responseTimeMs: z.number().int(),
    selectedOption: z.string(),
    questionType: z.nativeEnum(QuestionType),
    part: z.number().int(),
    snapshotPayload: z.object({
        meta: z.object({
            targetWordBlankIndex: z.number().int().optional(),
            target_word_blank_index: z.number().int().optional(),
        }),
        segments: z.array(z.any()),
    }).optional(),
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

    const validated = ArenaAttemptSchema.safeParse(json);
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
        const result = await recordMobileArenaAttempt(session.user, {
            ...validated.data,
            anchorVocabId: validated.data.anchorVocabId ?? null,
            snapshotPayload: validated.data.snapshotPayload
                ? {
                    ...validated.data.snapshotPayload,
                    meta: {
                        target_word_blank_index:
                            validated.data.snapshotPayload.meta.target_word_blank_index
                            ?? validated.data.snapshotPayload.meta.targetWordBlankIndex
                            ?? 1,
                    },
                }
                : undefined,
        });
        return Response.json(createMobileSuccessEnvelope(result));
    } catch (error) {
        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
