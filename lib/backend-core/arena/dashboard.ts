import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "arena-dashboard-core" });

export type RadarDomain = {
    code: string;
    label: string;
    score: number;
};

export type ActionRequiredNode = {
    id: string;
    name: string;
    description: string;
    score: number;
};

export interface SyntaxKnot {
    id: string;
    name: string;
    nameEn?: string;
    shortCode: string;
    masteryScore: number;
    availableQs: number;
}

export interface SyntaxCategory {
    l2Node: { id: string; name: string; nameEn?: string | null };
    knots: SyntaxKnot[];
}

export interface SyntaxMatrixData {
    l1Node: { code: string; name: string };
    categories: SyntaxCategory[];
}

export type ArenaOverview = {
    radar: RadarDomain[];
    weakNodes: ActionRequiredNode[];
    destinations: {
        part5: { kind: "arena"; value: "part5" };
        mission: { kind: "arena"; value: "mission" };
    };
};

const L1_DOMAINS = [
    { code: "L1_VERBS", label: "动词逻辑" },
    { code: "L1_PARTS_OF_SPEECH", label: "词性运用" },
    { code: "L1_CONNECTIVES", label: "连词介词" },
    { code: "L1_SPECIAL_SYNTAX", label: "特殊句法" },
    { code: "L1_CLAUSES", label: "从句解析" },
];

function getFallbackRadar(): RadarDomain[] {
    return L1_DOMAINS.map((domain) => ({
        ...domain,
        score: 0,
    }));
}

function generateShortCode(nameEn?: string | null, name?: string): string {
    const text = nameEn && nameEn.length > 0 ? nameEn : (name || "Xx");
    const words = text.split(" ").filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).substring(0, 2);
    }
    return text.substring(0, 2);
}

export async function getArenaRadarDataForUser(userId: string): Promise<RadarDomain[]> {
    try {
        const proficiencies = await prisma.userGrammarProficiency.findMany({
            where: {
                userId,
                grammarNode: { level: 1 },
            },
            include: { grammarNode: { select: { code: true } } },
        });

        const scoreMap = new Map<string, number>();
        proficiencies.forEach((proficiency) => {
            if (proficiency.grammarNode?.code && proficiency.masteryScore !== null) {
                scoreMap.set(proficiency.grammarNode.code, Math.round(proficiency.masteryScore * 100));
            }
        });

        return L1_DOMAINS.map((domain) => ({
            code: domain.code,
            label: domain.label,
            score: scoreMap.get(domain.code) ?? 0,
        }));
    } catch (err) {
        log.error({ err }, "Failed to fetch arena radar data");
        return getFallbackRadar();
    }
}

export async function getArenaActionRequiredNodesForUser(userId: string): Promise<ActionRequiredNode[]> {
    try {
        const weakNodes = await prisma.userGrammarProficiency.findMany({
            where: {
                userId,
                masteryScore: { not: undefined },
                grammarNode: { level: 3 },
            },
            orderBy: {
                masteryScore: "asc",
            },
            take: 3,
            include: {
                grammarNode: { select: { id: true, name: true, description: true } },
            },
        });

        return weakNodes
            .filter((node) => node.masteryScore !== null && node.grammarNode !== null)
            .map((node) => ({
                id: node.grammarNode!.id,
                name: node.grammarNode!.name,
                description: node.grammarNode!.description || "",
                score: Math.round(node.masteryScore! * 100),
            }));
    } catch (err) {
        log.error({ err }, "Failed to fetch arena weak nodes");
        return [];
    }
}

export async function getArenaMatrixForUser(
    userId: string,
    domainCode = "L1_VERBS"
): Promise<SyntaxMatrixData | null> {
    try {
        const l1Node = await prisma.grammarNode.findUnique({
            where: { code: domainCode },
            select: { code: true, name: true, nameEn: true },
        });

        if (!l1Node) return null;

        const l3Nodes = await prisma.grammarNode.findMany({
            where: {
                level: 3,
                parent: {
                    parent: {
                        code: domainCode,
                    },
                },
            },
            include: {
                parent: {
                    select: { id: true, name: true, nameEn: true, sortOrder: true },
                },
                _count: {
                    select: { questions: true },
                },
            },
            orderBy: [
                { parent: { sortOrder: "asc" } },
                { sortOrder: "asc" },
            ],
        });

        if (l3Nodes.length === 0) {
            return {
                l1Node: { code: l1Node.code, name: l1Node.nameEn || l1Node.name },
                categories: [],
            };
        }

        const proficiencies = await prisma.userGrammarProficiency.findMany({
            where: {
                userId,
                grammarNodeId: { in: l3Nodes.map((node) => node.id) },
            },
            select: { grammarNodeId: true, masteryScore: true },
        });

        const scoreMap = new Map<string, number>();
        proficiencies.forEach((proficiency) => {
            if (proficiency.masteryScore !== null) {
                scoreMap.set(proficiency.grammarNodeId, Math.round((proficiency.masteryScore ?? 0.5) * 100));
            }
        });

        const categoryMap = new Map<string, SyntaxCategory>();
        for (const knot of l3Nodes) {
            if (!knot.parent) continue;

            const l2Id = knot.parent.id;
            if (!categoryMap.has(l2Id)) {
                categoryMap.set(l2Id, {
                    l2Node: {
                        id: knot.parent.id,
                        name: knot.parent.name,
                        nameEn: knot.parent.nameEn,
                    },
                    knots: [],
                });
            }

            categoryMap.get(l2Id)!.knots.push({
                id: knot.id,
                name: knot.name,
                nameEn: knot.nameEn || undefined,
                shortCode: generateShortCode(knot.nameEn, knot.name),
                masteryScore: scoreMap.get(knot.id) ?? 50,
                availableQs: knot._count.questions,
            });
        }

        return {
            l1Node: { code: l1Node.code, name: l1Node.nameEn || l1Node.name },
            categories: Array.from(categoryMap.values()),
        };
    } catch (err) {
        log.error({ err, domainCode }, "Failed to fetch arena syntax matrix");
        return null;
    }
}

export async function getArenaOverviewForUser(userId: string): Promise<ArenaOverview> {
    const [radar, weakNodes] = await Promise.all([
        getArenaRadarDataForUser(userId),
        getArenaActionRequiredNodesForUser(userId),
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
