import { recordArenaAttemptForUser, type AttemptRecordPayload } from "@/lib/backend-core/arena/attempt";
import { getArenaMatrixForUser, getArenaOverviewForUser } from "@/lib/backend-core/arena/dashboard";
import { generateArenaMissionForUser } from "@/lib/backend-core/arena/mission";

export async function getMobileArenaOverview(userId: string) {
    return getArenaOverviewForUser(userId);
}

export async function getMobileArenaMatrix(domain: string, userId: string) {
    return getArenaMatrixForUser(userId, domain);
}

type MobileArenaUser = {
    id: string;
    name?: string | null;
    email?: string | null;
};

export async function getMobileArenaMission(user: MobileArenaUser) {
    return generateArenaMissionForUser(user.id);
}

export async function recordMobileArenaAttempt(
    user: MobileArenaUser,
    payload: AttemptRecordPayload
) {
    return recordArenaAttemptForUser(user.id, payload);
}
