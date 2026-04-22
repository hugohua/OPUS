import { db } from "@/lib/db";

export type MobileDashboardSummary = {
    userName: string;
    fsrs: {
        mastered: number;
        learning: number;
        due: number;
        telemetryScoreText: string;
    };
    primaryTask: {
        id: string;
        title: string;
        subtitle: string;
        detail: string;
        ctaTitle: string;
        mode: string;
    };
    trainingEntries: Array<{
        id: string;
        title: string;
        subtitle: string;
        detail: string;
        systemImage: string;
        badgeText?: string;
        destination: {
            kind: "training" | "arena";
            value: string;
        };
    }>;
    skillEntries: Array<{
        id: string;
        title: string;
        subtitle: string;
        detail: string;
        systemImage: string;
        destination: {
            kind: "training";
            value: string;
        };
    }>;
    latestBriefing: {
        id: string;
        title: string;
        subtitle: string;
        contextLabel: string;
        scenario: string;
    } | null;
    diagnostics: {
        statusTitle: string;
        detail: string;
    };
};

const scenarioDisplayMap = {
    finance_group: "金融与法务",
    hr_group: "人力与管理",
    ops_group: "运营与生产",
    market_group: "市场与客户",
    office_group: "办公与技术",
    travel_group: "差旅与活动",
    general: "商务简报",
} as const;

function formatRelativeDate(date: Date): string {
    const deltaMs = Date.now() - date.getTime();
    const deltaDays = Math.max(0, Math.floor(deltaMs / (1000 * 60 * 60 * 24)));

    if (deltaDays == 0) return "今天";
    if (deltaDays == 1) return "昨天";
    if (deltaDays < 7) return `${deltaDays} 天前`;
    if (deltaDays < 30) return `${Math.floor(deltaDays / 7)} 周前`;
    return `${Math.floor(deltaDays / 30)} 个月前`;
}

function buildTelemetryScore(mastered: number, learning: number, due: number): string {
    const total = Math.max(mastered + learning + due, 1);
    const score = Math.round(((mastered + learning) * 100) / total);
    return `${score}% R`;
}

export async function getMobileDashboardSummary(userId: string, userName?: string | null): Promise<MobileDashboardSummary> {
    const now = new Date();

    const [mastered, learning, due, latestBriefing] = await Promise.all([
        db.userProgress.count({
            where: { userId, track: "VISUAL", status: "MASTERED" },
        }),
        db.userProgress.count({
            where: { userId, track: "VISUAL", status: { in: ["LEARNING", "REVIEW"] } },
        }),
        db.userProgress.count({
            where: {
                userId,
                track: "VISUAL",
                next_review_at: { lte: now },
                status: { in: ["LEARNING", "REVIEW", "MASTERED"] },
            },
        }),
        db.article.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                createdAt: true,
                body: true,
            },
        }),
    ]);

    const scenarioId = (latestBriefing?.body as { context?: { scenarioId?: string } } | null)?.context?.scenarioId ?? "general";
    const scenarioLabel = scenarioDisplayMap[scenarioId as keyof typeof scenarioDisplayMap] ?? scenarioId;

    return {
        userName: userName || "学习者",
        fsrs: {
            mastered,
            learning,
            due,
            telemetryScoreText: buildTelemetryScore(mastered, learning, due),
        },
        primaryTask: {
            id: "daily-blitz",
            title: "每日闪电战",
            subtitle: "20 词 · 混合模式",
            detail: due > 0 ? `${due} 个待复习` : "今天可直接开练",
            ctaTitle: "进入训练",
            mode: "DAILY_BLITZ",
        },
        trainingEntries: [
            {
                id: "arena-blitz",
                title: "单句闪电战",
                subtitle: "碎片极速快测",
                detail: "Part 5",
                systemImage: "bolt",
                badgeText: "Part 5",
                destination: { kind: "arena", value: "part5" },
            },
            {
                id: "arena-mission",
                title: "阅读狙击战",
                subtitle: "沉浸商务实战",
                detail: "Part 6/7",
                systemImage: "book",
                badgeText: "Part 6/7",
                destination: { kind: "arena", value: "mission" },
            },
            {
                id: "review-cards",
                title: "复习卡组",
                subtitle: "滑动复习",
                detail: "记忆",
                systemImage: "checklist.checked",
                badgeText: "记忆",
                destination: { kind: "training", value: "review-cards" },
            },
        ],
        skillEntries: [
            {
                id: "l0-mixed",
                title: "极速挑战",
                subtitle: "视觉 & 语义 (L0)",
                detail: "L0",
                systemImage: "bolt.badge.a",
                destination: { kind: "training", value: "L0_MIXED" },
            },
            {
                id: "audio",
                title: "听力训练",
                subtitle: "听力 & 逻辑 (L1)",
                detail: "L1",
                systemImage: "speaker.wave.2",
                destination: { kind: "training", value: "audio" },
            },
            {
                id: "l2-mixed",
                title: "情境实验室",
                subtitle: "实战演练 (L2)",
                detail: "L2",
                systemImage: "brain.head.profile",
                destination: { kind: "training", value: "L2_MIXED" },
            },
        ],
        latestBriefing: latestBriefing
            ? {
                id: latestBriefing.id,
                title: latestBriefing.title,
                subtitle: formatRelativeDate(latestBriefing.createdAt),
                contextLabel: scenarioLabel,
                scenario: scenarioId,
            }
            : null,
        diagnostics: {
            statusTitle: "调试环境就绪",
            detail: "Local API 与原生壳层已连接，可随时切换到诊断面板。",
        },
    };
}
