import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { BriefingPayload } from '@/types/briefing';

export interface MistakeLog {
    id: string; // The ID of the most recent mistake record in this cluster
    questionSeedId: string | null;
    part: number;
    grammarNodeId: string | null;
    questionType: string | null;
    snapshot: BriefingPayload;
    userWrongAnswer: string;
    correctAnswer: string;
    failCount: number;
    lastSeenAt: Date;
    status: string;
}

export interface ErrorLogsResponse {
    highFrequencyLogs: MistakeLog[];
    recentLogs: MistakeLog[];
    totalUnresolved: number;
    categories: {
        grammar: number;
        lexical: number;
    };
    grammarNodes: { id: string; name: string; count: number }[];
}

/**
 * 获取当前用户的错题记录列表，并在内存中进行按题聚合。
 */
export async function getErrorLogs(): Promise<ErrorLogsResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const userId = session.user.id;

    // 拉取所有 ACTIVE 的错题记录
    // [Audit Warning Fix] 增设 500 条硬上限防线，防止无节制的全量拉取导致后端 V8 引擎 OOM 及 CPU 阻塞。
    // 未来若是数据量继续膨胀，应迁移至 \`prisma.groupBy\` 和游标分页。
    const rawLogs = await prisma.userMistakeBook.findMany({
        where: {
            userId,
            status: 'ACTIVE',
        },
        orderBy: {
            createdAt: 'desc', // 最近错的优先
        },
        take: 500,
    });

    const totalUnresolved = rawLogs.length; // 总的错题次数（注：如果是总未解决的"题目"数，应该是聚合后的长度）

    // 1. 按照 questionSeedId 或者 snapshot 内容的特征指纹进行聚合
    // 如果 questionSeedId 存在则按照其聚合，如果不存在（旧版本或 fallback），则把目标词当主键糊弄一下
    const clusterMap = new Map<string, MistakeLog>();

    for (const row of rawLogs) {
        // 利用 seedId，或退化为 snapshot 里的目标词作为聚类 Key
        const snapshot = row.snapshot as unknown as BriefingPayload;
        const seedId = snapshot?.meta?.questionSeedId;
        const fallbackKey = snapshot?.meta?.target_word || row.id;
        const key = seedId ? `seed_${seedId}` : `fallback_${fallbackKey}`;

        if (clusterMap.has(key)) {
            const existing = clusterMap.get(key)!;
            // 已经是按 desc 排序拉取的，遇到的第一个应该是最新的
            existing.failCount += 1;
        } else {
            clusterMap.set(key, {
                id: row.id,
                questionSeedId: seedId || null,
                part: row.part,
                grammarNodeId: row.grammarNodeId,
                questionType: row.questionType,
                snapshot,
                userWrongAnswer: row.userWrongAnswer,
                correctAnswer: row.correctAnswer,
                failCount: 1,
                lastSeenAt: row.createdAt,
                status: row.status,
            });
        }
    }

    // 2. 将聚类后的数据打平并排序
    const allClusters = Array.from(clusterMap.values());
    const uniqueUnresolvedCount = allClusters.length; // UX: "42 UNRESOLVED" 是指 42 道独立的题还是 42 次错误？通常题数更合理

    // 简单分拣：GRAMMAR (Part 5 及带 grammarNode) vs LEXICAL (Part 6 或词汇型)
    let grammarCount = 0;
    let lexicalCount = 0;

    const highFreq: MistakeLog[] = [];
    const recent: MistakeLog[] = [];

    for (const c of allClusters) {
        // 分类统计
        if (c.questionType === 'GRAMMAR' || c.questionType === 'MORPHOLOGY' || !!c.grammarNodeId) {
            grammarCount++;
        } else {
            lexicalCount++; // 粗略归为词汇或其它
        }

        // 高低频分类分配
        if (c.failCount >= 3) {
            highFreq.push(c);
        } else {
            recent.push(c);
        }
    }

    // 补充二次排序：高频区按出错次数降序，同次数按最新时间降序；近期区按最新时间降序
    highFreq.sort((a, b) => {
        if (b.failCount !== a.failCount) return b.failCount - a.failCount;
        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    });

    recent.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

    // 聚合并获取 GrammarNodes 信息
    const grammarNodeCounts = new Map<string, number>();
    for (const c of allClusters) {
        if (c.grammarNodeId) {
            grammarNodeCounts.set(c.grammarNodeId, (grammarNodeCounts.get(c.grammarNodeId) || 0) + 1);
        }
    }

    const grammarNodeIds = Array.from(grammarNodeCounts.keys());
    let grammarNodesInfo: { id: string; name: string; count: number }[] = [];

    if (grammarNodeIds.length > 0) {
        const nodes = await prisma.grammarNode.findMany({
            where: { id: { in: grammarNodeIds } },
            select: { id: true, name: true }
        });

        // 将 db 返回的 name 结合 counts 构建数组，并剔除未能找到的野指针
        grammarNodesInfo = nodes.map(node => ({
            id: node.id,
            name: node.name,
            count: grammarNodeCounts.get(node.id) || 0
        })).sort((a, b) => b.count - a.count); // 默认按错题数降序排序
    }

    return {
        highFrequencyLogs: highFreq,
        recentLogs: recent,
        totalUnresolved: uniqueUnresolvedCount,
        categories: {
            grammar: grammarCount,
            lexical: lexicalCount,
        },
        grammarNodes: grammarNodesInfo,
    };
}
