import { db } from "@/lib/db";
import { buildNotMasteredVocabWhere } from "@/lib/vocab-state/filters";

export type DashboardFSRSSummary = {
    mastered: number;
    learning: number;
    due: number;
    telemetryScoreText: string;
};

function buildTelemetryScore(mastered: number, learning: number, due: number): string {
    const total = Math.max(mastered + learning + due, 1);
    const score = Math.round(((mastered + learning) * 100) / total);
    return `${score}% R`;
}

export async function getDashboardFSRSSummary(userId: string, now = new Date()): Promise<DashboardFSRSSummary> {
    const notMasteredVocabWhere = buildNotMasteredVocabWhere(userId);

    const [mastered, learning, due] = await Promise.all([
        db.userVocabState.count({
            where: { userId, status: "MASTERED" },
        }),
        db.userProgress.count({
            where: {
                userId,
                track: "VISUAL",
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: notMasteredVocabWhere,
            },
        }),
        db.userProgress.count({
            where: {
                userId,
                track: "VISUAL",
                next_review_at: { lte: now },
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: notMasteredVocabWhere,
            },
        }),
    ]);

    return {
        mastered,
        learning,
        due,
        telemetryScoreText: buildTelemetryScore(mastered, learning, due),
    };
}
