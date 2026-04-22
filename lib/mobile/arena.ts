import { getActionRequiredNodes, getRadarData, getSyntaxMatrixData } from "@/actions/grammar-dashboard";

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
