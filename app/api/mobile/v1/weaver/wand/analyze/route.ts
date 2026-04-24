import { z } from "zod";
import { createMobileErrorEnvelope, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { createMobileBriefingWandAnalyzeStream } from "@/lib/mobile/briefing";

export const dynamic = "force-dynamic";

const AnalyzeSchema = z.object({
    text: z.string().trim().min(1),
    type: z.enum(["word", "sentence"]),
    context: z.string().trim().min(1).optional(),
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

    const validated = AnalyzeSchema.safeParse(json);
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

    if (validated.data.type == "word" && !validated.data.context) {
        return Response.json(
            createMobileErrorEnvelope("VALIDATION_ERROR", "context is required for word mode"),
            { status: 400 }
        );
    }

    const stream = createMobileBriefingWandAnalyzeStream(validated.data);
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
