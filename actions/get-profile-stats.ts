"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

// ────────────────────────────────────────
// ProfileStats 接口
// ────────────────────────────────────────
export interface ProfileStats {
    /** 累计存活天数 (Anti-Spec 合规: 累计制，非连续制) */
    totalDaysSurvived: number;
    /** 已掌握词汇数 */
    totalMastered: number;

    /** 五维认知雷达 (V/A/M/C/X 平均分, 0-100) */
    skillRadar: {
        V: number; A: number; M: number; C: number; X: number;
    };

    /** FSRS 记忆健康分布 */
    memoryHealth: {
        newCount: number;
        learningCount: number;
        reviewCount: number;
        masteredCount: number;
        retentionRate: number;
    };

    /** 未来 5 天复习负载 */
    loadForecast: Array<{ date: string; count: number }>;

    /** 过去 90 天活跃日期 (ISO date string) */
    activeDays: string[];

    /** 低分词/高遗忘词数量 */
    errorWords: number;

    /** 薄弱词汇判定标准说明 */
    weakWordsCriteria: string;
}

// ────────────────────────────────────────
// 空状态兜底
// ────────────────────────────────────────
const EMPTY_STATS: ProfileStats = {
    totalDaysSurvived: 0,
    totalMastered: 0,
    skillRadar: { V: 0, A: 0, M: 0, C: 0, X: 0 },
    memoryHealth: { newCount: 0, learningCount: 0, reviewCount: 0, masteredCount: 0, retentionRate: 0 },
    loadForecast: [],
    activeDays: [],
    errorWords: 0,
    weakWordsCriteria: "暂无数据",
};

// ────────────────────────────────────────
// 主查询
// ────────────────────────────────────────
export async function getProfileStats(): Promise<ProfileStats> {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user?.id) return EMPTY_STATS;

        const userId = user.id;
        const now = new Date();

        // 90 天前
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // 5 天后
        const fiveDaysLater = new Date(now);
        fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);

        // ── 所有查询并行化 (Promise.all) ──
        const [
            // 1. 五维平均分 ($queryRaw 单条聚合)
            radarResult,
            // 2. FSRS 状态分布 (4 个 count)
            newCount, learningCount, reviewCount, masteredCount,
            // 3. 过去 90 天活跃日期 (热力图)
            activeDaysResult,
            // 4. 未来 5 天负载
            loadResult,
            // 5. 低分词
            errorWordsCount,
            // 6. 累计存活天数 (全量，不受 90 天窗口限制)
            totalDaysResult,
        ] = await Promise.all([
            // ① 五维雷达
            db.$queryRaw<Array<{
                avg_v: number | null; avg_a: number | null;
                avg_m: number | null; avg_c: number | null; avg_x: number | null;
            }>>`
                SELECT 
                    COALESCE(AVG(dim_v_score), 0)::int as avg_v,
                    COALESCE(AVG(dim_a_score), 0)::int as avg_a,
                    COALESCE(AVG(dim_m_score), 0)::int as avg_m,
                    COALESCE(AVG(dim_c_score), 0)::int as avg_c,
                    COALESCE(AVG(dim_x_score), 0)::int as avg_x
                FROM "UserProgress"
                WHERE "userId" = ${userId} AND status != 'NEW'::"LearningStatus"
            `,

            // ② 状态分布
            db.userProgress.count({ where: { userId, status: 'NEW' } }),
            db.userProgress.count({ where: { userId, status: 'LEARNING' } }),
            db.userProgress.count({ where: { userId, status: 'REVIEW' } }),
            db.userProgress.count({ where: { userId, status: 'MASTERED' } }),

            // ③ 过去 90 天活跃日期 (distinct dates)
            db.$queryRaw<Array<{ active_date: Date }>>`
                SELECT DISTINCT DATE(last_review_at) as active_date
                FROM "UserProgress"
                WHERE "userId" = ${userId}
                    AND last_review_at >= ${ninetyDaysAgo}
                    AND last_review_at IS NOT NULL
                ORDER BY active_date
            `,

            // ④ 未来 5 天负载
            db.$queryRaw<Array<{ review_date: Date; count: bigint }>>`
                SELECT DATE(next_review_at) as review_date, COUNT(*)::bigint as count
                FROM "UserProgress"
                WHERE "userId" = ${userId}
                    AND next_review_at >= ${now}
                    AND next_review_at <= ${fiveDaysLater}
                    AND next_review_at IS NOT NULL
                GROUP BY DATE(next_review_at)
                ORDER BY review_date
            `,

            // ⑤ 低分词 (masteryScore < 30 或 lapses > 3)
            db.userProgress.count({
                where: {
                    userId,
                    status: { not: 'NEW' },
                    OR: [
                        { masteryScore: { lt: 30 } },
                        { lapses: { gt: 3 } },
                    ],
                },
            }),

            // ⑥ 累计存活天数 (全量，Anti-Spec §9.1 "cumulative only")
            db.$queryRaw<Array<{ total_days: bigint }>>`
                SELECT COUNT(DISTINCT DATE(last_review_at))::bigint as total_days
                FROM "UserProgress"
                WHERE "userId" = ${userId} AND last_review_at IS NOT NULL
            `,
        ]);

        // ── 后处理 ──
        const radar = radarResult[0] || { avg_v: 0, avg_a: 0, avg_m: 0, avg_c: 0, avg_x: 0 };

        const total = newCount + learningCount + reviewCount + masteredCount;
        const retentionRate = total > 0
            ? Math.round((masteredCount / total) * 100)
            : 0;

        const activeDays = activeDaysResult.map(r => {
            const d = new Date(r.active_date);
            return d.toISOString().split('T')[0];
        });

        const loadForecast = loadResult.map(r => ({
            date: new Date(r.review_date).toISOString().split('T')[0],
            count: Number(r.count),
        }));

        return {
            totalDaysSurvived: Number(totalDaysResult[0]?.total_days ?? 0),
            totalMastered: masteredCount,
            skillRadar: {
                V: Number(radar.avg_v) || 0,
                A: Number(radar.avg_a) || 0,
                M: Number(radar.avg_m) || 0,
                C: Number(radar.avg_c) || 0,
                X: Number(radar.avg_x) || 0,
            },
            memoryHealth: {
                newCount,
                learningCount,
                reviewCount,
                masteredCount,
                retentionRate,
            },
            loadForecast,
            activeDays,
            errorWords: errorWordsCount,
            weakWordsCriteria: "掌握度 < 30% 或遗忘次数 > 3 的词汇",
        };
    } catch (error) {
        console.error("[getProfileStats] Failed:", error);
        return EMPTY_STATS;
    }
}
