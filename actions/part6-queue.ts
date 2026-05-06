"use server";

import { auth } from "@/auth";
import { generateArenaMissionForUser } from "@/lib/backend-core/arena/mission";
import { logger } from "@/lib/logger";
import { buildArenaPart6FallbackDrill } from "@/lib/templates/arena-fallback";
import { type BriefingPayload } from "@/types/briefing";

const log = logger.child({ module: "part6-queue" });

export async function generatePart6Session(): Promise<BriefingPayload> {
    const session = await auth();
    if (!session?.user?.id) {
        log.warn("Unauthenticated attempt to generate Part 6 session");
        return buildArenaPart6FallbackDrill("authentication_failed");
    }
    return generateArenaMissionForUser(session.user.id);
}

export async function generatePart6SessionForUser(userId: string): Promise<BriefingPayload> {
    return generateArenaMissionForUser(userId);
}
