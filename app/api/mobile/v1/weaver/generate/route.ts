import { z } from "zod";

import { createLogger } from "@/lib/logger";
import { handleOpenAIStream } from "@/lib/streaming/sse";
import { createMobileErrorEnvelope, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { createWeaverGenerationJobForUser } from "@/lib/backend-core/weaver/generation";
import { WEAVER_DENSITY_IDS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = createLogger("api:mobile:weaver");

const MobileWeaverGenerateSchema = z.object({
    scenario: z.enum(WEAVER_SCENARIOS.map(({ id }) => id) as [string, ...string[]]),
    density: z.enum(WEAVER_DENSITY_IDS),
    targetWordIds: z.array(z.number()).default([]),
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

    const validated = MobileWeaverGenerateSchema.safeParse(json);
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
        const userId = session.user.id;
        const job = await createWeaverGenerationJobForUser(userId, validated.data);

        if (job.kind === "cached") {
            return createCachedGenerationResponse(job.content, job.headers);
        }

        return handleOpenAIStream(job.messages, {
            model: job.model,
            temperature: job.temperature,
            errorContext: job.errorContext,
            headers: job.headers,
            onComplete: job.onComplete,
        });
    } catch (error) {
        log.error({ error }, "Mobile weaver generation failed");
        if (error instanceof Error && error.message === "User not found") {
            return mobileUnauthorizedResponse("User not found");
        }

        return Response.json(
            createMobileErrorEnvelope(
                "INTERNAL_ERROR",
                error instanceof Error ? error.message : "Failed to generate briefing"
            ),
            { status: 500 }
        );
    }
}

function createCachedGenerationResponse(content: string, headers: Record<string, string>) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", data: content })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            controller.close();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            ...headers,
        },
    });
}
