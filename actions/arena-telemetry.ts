'use server';

import { auth } from "@/auth";
import {
    recordArenaAttemptForUser,
    type AttemptRecordPayload,
} from "@/lib/backend-core/arena/attempt";

export async function recordArenaOutcome(payload: AttemptRecordPayload) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    return recordArenaAttemptForUser(session.user.id, payload);
}

export async function recordArenaOutcomeForUser(userId: string, payload: AttemptRecordPayload) {
    return recordArenaAttemptForUser(userId, payload);
}
