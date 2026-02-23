'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'grammar-dashboard' });

// ---------------------------------------------------------------------------
// 严格的 L1 维度映射 (顺时针)
// ---------------------------------------------------------------------------

export type RadarDomain = {
    code: string;
    label: string;
    score: number; // 0-100
};

// 预期的 L1 Codes，决定雷达图 5 个轴的顺序
const L1_DOMAINS = [
    { code: 'L1_VERBS', label: '动词逻辑' },            // Top
    { code: 'L1_PARTS_OF_SPEECH', label: '词性运用' },  // Top Right (词汇/名词)
    { code: 'L1_CONNECTIVES', label: '连词介词' },      // Bottom Right (虚词/连词)
    { code: 'L1_SPECIAL_SYNTAX', label: '特殊句法' },  // Bottom Left (特殊句法)
    { code: 'L1_CLAUSES', label: '从句解析' },        // Top Left (从句)
];

/**
 * 获取雷达图数据
 * 防护 1: SSR 保证 Zero-Wait
 * 防护 2: N+1 查询规避 (一次查出所有 L1 后在内存中拼接)
 * 防护 3: 冷启动兜底 (没做过的领域默认 0分)
 */
export async function getRadarData(): Promise<RadarDomain[]> {
    const session = await auth();
    if (!session?.user?.id) return getFallbackRadar();

    try {
        // [N+1 防御] 一次性捞出该用户在所有 level=1 节点上的熟练度
        const proficiencies = await prisma.userGrammarProficiency.findMany({
            where: {
                userId: session.user.id,
                grammarNode: { level: 1 }
            },
            include: { grammarNode: { select: { code: true } } }
        });

        // 打成 Map 加速查找
        const scoreMap = new Map<string, number>();
        proficiencies.forEach(p => {
            if (p.grammarNode?.code && p.masteryScore !== null) {
                // 转换为 0-100 的整数
                scoreMap.set(p.grammarNode.code, Math.round(p.masteryScore * 100));
            }
        });

        // 按照固定顺序组装 (Cold Start 兜底为 0)
        return L1_DOMAINS.map(domain => ({
            code: domain.code,
            label: domain.label,
            score: scoreMap.get(domain.code) ?? 0,
        }));

    } catch (err) {
        log.error({ err }, 'Failed to fetch radar data');
        return getFallbackRadar();
    }
}

function getFallbackRadar(): RadarDomain[] {
    return L1_DOMAINS.map(domain => ({
        ...domain,
        score: 0,
    }));
}

// ---------------------------------------------------------------------------
// Action Required: 最薄弱的 L3 节点
// ---------------------------------------------------------------------------

export type ActionRequiredNode = {
    id: string;
    name: string;
    description: string;
    score: number; // 0-100
};

/**
 * 获取亟需提升的薄弱语法点 (Top 3)
 * 防护 1: 必须是有做题记录的 (masteryScore 不为 null)
 * 防护 2: 仅查找叶子节点 (level 3)
 */
export async function getActionRequiredNodes(): Promise<ActionRequiredNode[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const weakNodes = await prisma.userGrammarProficiency.findMany({
            where: {
                userId: session.user.id,
                masteryScore: { not: undefined }, // Prisma uses undefined to omit, Prisma null filter is different
                grammarNode: { level: 3 }
            },
            orderBy: {
                masteryScore: 'asc' // 升序，最薄弱的排前面
            },
            take: 3,
            include: {
                grammarNode: { select: { id: true, name: true, description: true } }
            }
        });

        // 二次过滤确保 null 也被滤掉，防止 TS 报错
        const validNodes = weakNodes.filter(n => n.masteryScore !== null && n.grammarNode !== null);

        return validNodes.map(p => ({
            id: p.grammarNode!.id,
            name: p.grammarNode!.name,
            description: p.grammarNode!.description || '',
            score: Math.round(p.masteryScore! * 100),
        }));

    } catch (err) {
        log.error({ err }, 'Failed to fetch weak nodes');
        return [];
    }
}

// ---------------------------------------------------------------------------
// Syntax Matrix: 零 N+1 全图聚合
// ---------------------------------------------------------------------------

export interface SyntaxKnot {
    id: string;
    name: string;      // e.g. "现在完成时"
    nameEn?: string;   // e.g. "Present Perfect"
    shortCode: string; // e.g. "Pp"
    masteryScore: number; // 0-100
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

/**
 * 辅助方法：生成类似 "Pr", "Pp", "Sj" 的双字母短标
 */
function generateShortCode(nameEn?: string | null, name?: string): string {
    const text = nameEn && nameEn.length > 0 ? nameEn : (name || 'Xx');
    const words = text.split(' ').filter(Boolean);
    if (words.length >= 2) {
        // e.g. Present Perfect -> Pp
        return (words[0][0] + words[1][0]).substring(0, 2);
    }
    // e.g. Subjunctive -> Su
    return text.substring(0, 2);
}

/**
 * 取回指定 L1 Domain 下的所有 L2 分类与 L3 叶子节点 (0 N+1 并集)
 */
export async function getSyntaxMatrixData(domainCode?: string): Promise<SyntaxMatrixData | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const targetDomain = domainCode || 'L1_VERBS';

    try {
        // 1. 获取 L1 节点基础信息
        const l1Node = await prisma.grammarNode.findUnique({
            where: { code: targetDomain },
            select: { code: true, name: true, nameEn: true }
        });

        if (!l1Node) return null;

        // 2. 一次性获取挂载在该 L1 下的所有 L3 及带有父节点 (L2) 信息
        const l3Nodes = await prisma.grammarNode.findMany({
            where: {
                level: 3,
                parent: {
                    parent: {
                        code: targetDomain
                    }
                }
            },
            include: {
                parent: {
                    select: { id: true, name: true, nameEn: true, sortOrder: true }
                },
                _count: {
                    select: { questions: true }
                } // 替代查题数，不用多次查询
            },
            orderBy: [
                { parent: { sortOrder: 'asc' } },
                { sortOrder: 'asc' }
            ]
        });

        if (l3Nodes.length === 0) {
            return {
                l1Node: { code: l1Node.code, name: l1Node.nameEn || l1Node.name },
                categories: []
            };
        }

        // 3. 一次性获取该用户在这些 L3 上的熟练度
        const proficiencies = await prisma.userGrammarProficiency.findMany({
            where: {
                userId: session.user.id,
                grammarNodeId: { in: l3Nodes.map(n => n.id) }
            },
            select: { grammarNodeId: true, masteryScore: true }
        });

        const scoreMap = new Map<string, number>();
        proficiencies.forEach(p => {
            if (p.masteryScore !== null) { // 规避 undefined 报错
                scoreMap.set(p.grammarNodeId, Math.round((p.masteryScore ?? 0.5) * 100)); // 默认 50分
            }
        });

        // 4. 内存级 Map-Reduce (Category 分组)
        const categoryMap = new Map<string, SyntaxCategory>();

        for (const knot of l3Nodes) {
            if (!knot.parent) continue;

            const l2Id = knot.parent.id;
            if (!categoryMap.has(l2Id)) {
                categoryMap.set(l2Id, {
                    l2Node: {
                        id: knot.parent.id,
                        name: knot.parent.name,
                        nameEn: knot.parent.nameEn
                    },
                    knots: []
                });
            }

            const cat = categoryMap.get(l2Id)!;
            const score = scoreMap.get(knot.id) ?? 50; // 未考查的默认 50%

            cat.knots.push({
                id: knot.id,
                name: knot.name,
                nameEn: knot.nameEn || undefined,
                shortCode: generateShortCode(knot.nameEn, knot.name), // e.g. "Pp"
                masteryScore: score,
                availableQs: knot._count.questions
            });
        }

        // 返回按插入顺序(由于 DB orderBy 已经排好序)的值列表
        return {
            l1Node: { code: l1Node.code, name: l1Node.nameEn || l1Node.name },
            categories: Array.from(categoryMap.values())
        };

    } catch (err) {
        log.error({ err, targetDomain }, 'Failed to fetch Syntax Matrix Data');
        return null;
    }
}
