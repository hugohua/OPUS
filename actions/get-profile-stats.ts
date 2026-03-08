"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

// ────────────────────────────────────────
// ProfileStats 接口
// ────────────────────────────────────────
export interface UserLevel {
    /** 等级编号 0/1/2 */
    code: 0 | 1 | 2;
    /** 英文标签 */
    label: "Trainee" | "Intern" | "Executive";
    /** 中文标签 */
    labelCn: "实习生" | "正式员工" | "高管";
    /** 升级进度百分比 (0-100)，L2 时固定 100 */
    progress: number;
    /** 升级提示文案 */
    nextHint: string;
}

export interface ProfileStats {
    /** 用户等级 (纯展示, 不影响业务逻辑) */
    userLevel: UserLevel;
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

    /** 多轨记忆概览 (VISUAL/AUDIO/CONTEXT) */
    multiTrack: Record<'VISUAL' | 'AUDIO' | 'CONTEXT', TrackStats>;

    /** Arena 战绩摘要 */
    arenaSummary: ArenaStats;
}

export interface TrackStats {
    total: number;
    mastered: number;
    learning: number;
    new: number;
}

export interface ArenaStats {
    totalAttempts: number;
    correctCount: number;
    accuracyRate: number; // 0-100
    avgResponseMs: number;
    part5: { total: number; correct: number; rate: number };
    part6: { total: number; correct: number; rate: number };
}

// ────────────────────────────────────────
// 空状态兜底
// ────────────────────────────────────────
const EMPTY_STATS: ProfileStats = {
    userLevel: { code: 0, label: "Trainee", labelCn: "实习生", progress: 0, nextHint: "掌握 200 词 + 平均分 ≥ 35 升级" },
    totalDaysSurvived: 0,
    totalMastered: 0,
    skillRadar: { V: 0, A: 0, M: 0, C: 0, X: 0 },
    memoryHealth: { newCount: 0, learningCount: 0, reviewCount: 0, masteredCount: 0, retentionRate: 0 },
    loadForecast: [],
    activeDays: [],
    errorWords: 0,
    weakWordsCriteria: "暂无数据",
    multiTrack: {
        VISUAL: { total: 0, mastered: 0, learning: 0, new: 0 },
        AUDIO: { total: 0, mastered: 0, learning: 0, new: 0 },
        CONTEXT: { total: 0, mastered: 0, learning: 0, new: 0 },
    },
    arenaSummary: {
        totalAttempts: 0, correctCount: 0, accuracyRate: 0, avgResponseMs: 0,
        part5: { total: 0, correct: 0, rate: 0 },
        part6: { total: 0, correct: 0, rate: 0 },
    },
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
            // 2. FSRS 状态分布 (单条 GROUP BY 替代 4 次 count)
            statusDistribution,
            // 3. 过去 90 天活跃日期 (热力图)
            activeDaysResult,
            // 4. 未来 5 天负载
            loadResult,
            // 5. 低分词
            errorWordsCount,
            // 6. 累计存活天数 (全量，不受 90 天窗口限制)
            totalDaysResult,
            // 7. 多轨分布
            trackDistribution,
            // 8. Arena 战绩
            arenaResult,
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

            // ② 状态分布 (1 条 SQL 替代 4 次 count)
            db.$queryRaw<Array<{ status: string; cnt: bigint }>>`
                SELECT status::text, COUNT(*)::bigint AS cnt
                FROM "UserProgress"
                WHERE "userId" = ${userId}
                GROUP BY status
            `,

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

            // ⑦ 多轨分布 (track × status)
            db.$queryRaw<Array<{ track: string; status: string; cnt: bigint }>>`
                SELECT track, status::text, COUNT(*)::bigint AS cnt
                FROM "UserProgress"
                WHERE "userId" = ${userId}
                GROUP BY track, status
            `,

            // ⑧ Arena 战绩 (part × isCorrect 聚合 + 平均响应时间)
            db.$queryRaw<Array<{ part: number; is_correct: boolean | string; cnt: bigint; avg_ms: number }>>`
                SELECT part, "isCorrect" as is_correct, COUNT(*)::bigint AS cnt,
                       COALESCE(AVG("responseTimeMs"), 0)::int AS avg_ms
                FROM "AttemptRecord"
                WHERE "userId" = ${userId}
                GROUP BY part, "isCorrect"
            `,
        ]);

        // ── 后处理 ──
        const radar = radarResult[0] || { avg_v: 0, avg_a: 0, avg_m: 0, avg_c: 0, avg_x: 0 };

        // 从 GROUP BY 结果提取各状态计数
        const statusMap = Object.fromEntries(
            statusDistribution.map(r => [r.status, Number(r.cnt)])
        );
        const newCount = statusMap['NEW'] ?? 0;
        const learningCount = statusMap['LEARNING'] ?? 0;
        const reviewCount = statusMap['REVIEW'] ?? 0;
        const masteredCount = statusMap['MASTERED'] ?? 0;

        const total = newCount + learningCount + reviewCount + masteredCount;
        const retentionRate = total > 0
            ? Math.round((masteredCount / total) * 100)
            : 0;

        const activeDays = activeDaysResult.map(r => {
            const d = new Date(r.active_date);
            return d.toISOString().split('T')[0];
        });

        // 生成服务端视角下未来 5 天（包含 0 数据）的完整序列
        const forecastDates = Array.from({ length: 5 }).map((_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        const loadForecast = forecastDates.map(dateStr => {
            const match = loadResult.find(r => new Date(r.review_date).toISOString().split('T')[0] === dateStr);
            return {
                date: dateStr,
                count: match ? Number(match.count) : 0,
            };
        });

        // ── 等级计算 (纯展示, PRD §4 Level System) ──
        const avgDim = Math.round((Number(radar.avg_v) + Number(radar.avg_a) + Number(radar.avg_m) + Number(radar.avg_c) + Number(radar.avg_x)) / 5);
        const userLevel = computeUserLevel(masteredCount, avgDim);

        return {
            userLevel,
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
            multiTrack: buildMultiTrack(trackDistribution),
            arenaSummary: buildArenaStats(arenaResult),
        };
    } catch (error) {
        console.error("[getProfileStats] Failed:", error);
        return EMPTY_STATS;
    }
}

// ────────────────────────────────────────
// Arena 战绩聚合
// ────────────────────────────────────────
function buildArenaStats(
    rows: Array<{ part: number; is_correct: boolean | string; cnt: bigint; avg_ms: number }>
): ArenaStats {
    let totalAttempts = 0, correctCount = 0, totalMs = 0;
    const parts: Record<number, { total: number; correct: number }> = { 5: { total: 0, correct: 0 }, 6: { total: 0, correct: 0 } };

    for (const row of rows) {
        const cnt = Number(row.cnt);
        const isCorrect = row.is_correct === true || row.is_correct === 't' || row.is_correct === 'true';

        totalAttempts += cnt;
        totalMs += row.avg_ms * cnt;
        if (isCorrect) correctCount += cnt;

        const p = parts[row.part];
        if (p) {
            p.total += cnt;
            if (isCorrect) p.correct += cnt;
        }
    }

    const rate = (t: number, c: number) => t > 0 ? Math.round((c / t) * 100) : 0;

    return {
        totalAttempts,
        correctCount,
        accuracyRate: rate(totalAttempts, correctCount),
        avgResponseMs: totalAttempts > 0 ? Math.round(totalMs / totalAttempts) : 0,
        part5: { ...parts[5], rate: rate(parts[5].total, parts[5].correct) },
        part6: { ...parts[6], rate: rate(parts[6].total, parts[6].correct) },
    };
}

// ────────────────────────────────────────
// 多轨聚合
// ────────────────────────────────────────
function buildMultiTrack(
    rows: Array<{ track: string; status: string; cnt: bigint }>
): Record<'VISUAL' | 'AUDIO' | 'CONTEXT', TrackStats> {
    const empty = (): TrackStats => ({ total: 0, mastered: 0, learning: 0, new: 0 });
    const result = { VISUAL: empty(), AUDIO: empty(), CONTEXT: empty() };

    for (const row of rows) {
        const track = row.track as keyof typeof result;
        if (!(track in result)) continue;
        const count = Number(row.cnt);
        result[track].total += count;
        if (row.status === 'MASTERED') result[track].mastered += count;
        else if (row.status === 'NEW') result[track].new += count;
        else result[track].learning += count; // LEARNING + REVIEW → 学习中
    }
    return result;
}

// ────────────────────────────────────────
// 等级阈值 (可调参)
// ────────────────────────────────────────
const LEVEL_THRESHOLDS = {
    L1: { mastered: 200, avgDim: 35 },
    L2: { mastered: 500, avgDim: 60 },
} as const;

// ────────────────────────────────────────
// 等级计算 (纯展示, 零业务副作用)
// ────────────────────────────────────────
function computeUserLevel(mastered: number, avgDimScore: number): UserLevel {
    const { L1, L2 } = LEVEL_THRESHOLDS;

    // L2: Executive
    if (mastered >= L2.mastered && avgDimScore >= L2.avgDim) {
        return {
            code: 2,
            label: "Executive",
            labelCn: "高管",
            progress: 100,
            nextHint: "已达最高等级",
        };
    }

    // L1: Intern
    if (mastered >= L1.mastered && avgDimScore >= L1.avgDim) {
        const wordProgress = Math.min(mastered / L2.mastered, 1);
        const scoreProgress = Math.min(avgDimScore / L2.avgDim, 1);
        const progress = Math.round(((wordProgress + scoreProgress) / 2) * 100);
        return {
            code: 1,
            label: "Intern",
            labelCn: "正式员工",
            progress,
            nextHint: `掌握 ${L2.mastered - mastered > 0 ? `再学 ${L2.mastered - mastered} 词` : "✓"} + ${avgDimScore < L2.avgDim ? `均分升至 ${L2.avgDim}` : "✓"} 可晋升`,
        };
    }

    // L0: Trainee (默认)
    const wordProgress = Math.min(mastered / L1.mastered, 1);
    const scoreProgress = Math.min(avgDimScore / L1.avgDim, 1);
    const progress = Math.round(((wordProgress + scoreProgress) / 2) * 100);
    return {
        code: 0,
        label: "Trainee",
        labelCn: "实习生",
        progress,
        nextHint: `掌握 ${L1.mastered - mastered > 0 ? `再学 ${L1.mastered - mastered} 词` : "✓"} + ${avgDimScore < L1.avgDim ? `均分升至 ${L1.avgDim}` : "✓"} 可晋升`,
    };
}
