import { getActionRequiredNodes, getRadarData, getSyntaxMatrixData } from "@/actions/grammar-dashboard";
import { recordArenaOutcomeForUser, type AttemptRecordPayload } from "@/actions/arena-telemetry";
import { generatePart6SessionForUser } from "@/actions/part6-queue";

export async function getMobileArenaOverview(userId: string) {
    const [radar, weakNodes] = await Promise.all([
        getRadarData(userId),
        getActionRequiredNodes(userId),
    ]);

    return {
        radar,
        weakNodes,
        destinations: {
            part5: { kind: "arena", value: "part5" },
            mission: { kind: "arena", value: "mission" },
        },
    };
}

export async function getMobileArenaMatrix(domain: string, userId: string) {
    return getSyntaxMatrixData(domain, userId);
}

type MobileArenaUser = {
    id: string;
    name?: string | null;
    email?: string | null;
};

export async function getMobileArenaMission(user: MobileArenaUser) {
    return generatePart6SessionForUser(user.id);
}

export async function recordMobileArenaAttempt(
    user: MobileArenaUser,
    payload: AttemptRecordPayload
) {
    return recordArenaOutcomeForUser(user.id, payload);
}
