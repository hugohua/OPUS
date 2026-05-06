'use server';

import { auth } from "@/auth";
import {
    getArenaActionRequiredNodesForUser,
    getArenaMatrixForUser,
    getArenaRadarDataForUser,
    type ActionRequiredNode,
    type RadarDomain,
    type SyntaxCategory,
    type SyntaxKnot,
    type SyntaxMatrixData,
} from "@/lib/backend-core/arena/dashboard";

const FALLBACK_RADAR: RadarDomain[] = [
    { code: "L1_VERBS", label: "动词逻辑", score: 0 },
    { code: "L1_PARTS_OF_SPEECH", label: "词性运用", score: 0 },
    { code: "L1_CONNECTIVES", label: "连词介词", score: 0 },
    { code: "L1_SPECIAL_SYNTAX", label: "特殊句法", score: 0 },
    { code: "L1_CLAUSES", label: "从句解析", score: 0 },
];

export async function getRadarData(userIdOverride?: string): Promise<RadarDomain[]> {
    const userId = await resolveUserId(userIdOverride);
    if (!userId) return FALLBACK_RADAR;
    return getArenaRadarDataForUser(userId);
}

export async function getActionRequiredNodes(userIdOverride?: string): Promise<ActionRequiredNode[]> {
    const userId = await resolveUserId(userIdOverride);
    if (!userId) return [];
    return getArenaActionRequiredNodesForUser(userId);
}

export async function getSyntaxMatrixData(
    domainCode?: string,
    userIdOverride?: string
): Promise<SyntaxMatrixData | null> {
    const userId = await resolveUserId(userIdOverride);
    if (!userId) return null;
    return getArenaMatrixForUser(userId, domainCode || "L1_VERBS");
}

async function resolveUserId(userIdOverride?: string) {
    if (userIdOverride) return userIdOverride;
    const session = await auth();
    return session?.user?.id ?? null;
}
