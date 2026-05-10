/**
 * 综合题型诊断共享核心
 * 功能：
 *   基于 Arena AttemptRecord 的 questionType 聚合用户题型表现。
 *   H5 Server Action 与 iOS Mobile API 只能调用这里，不在 adapter 中复制诊断规则。
 */

import { QuestionType } from "@prisma/client";
import { db } from "@/lib/db";

export interface WeaknessProfile {
    questionType: string;
    label: string;
    total: number;
    correct: number;
    accuracy: number;
    avgResponseMs: number;
}

export interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

export type DiagnosticRadarPayload = {
    radarData: RadarDataPoint[];
    weakest: WeaknessProfile | null;
    totalAttempts: number;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
    MORPHOLOGY: "词形变换",
    COLLOCATION: "词组搭配",
    GRAMMAR: "基础语法",
    SYNONYM: "近义辨析",
    PHRASAL_VERB: "动词短语",
    PRONOUN_REFERENCE: "代词指代",
};

const PART5_QUESTION_TYPES: QuestionType[] = [
    "MORPHOLOGY",
    "PHRASAL_VERB",
    "PRONOUN_REFERENCE",
    "GRAMMAR",
    "COLLOCATION",
    "SYNONYM",
];

export async function getUserWeaknessesRaw(
    userId: string,
    recentLimit = 100
): Promise<WeaknessProfile[]> {
    const records = await db.attemptRecord.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: recentLimit,
        select: {
            questionType: true,
            isCorrect: true,
            responseTimeMs: true,
        },
    });

    if (records.length === 0) return [];

    const buckets = new Map<string, { total: number; correct: number; totalMs: number }>();
    for (const record of records) {
        const key = record.questionType;
        const bucket = buckets.get(key) ?? { total: 0, correct: 0, totalMs: 0 };
        bucket.total += 1;
        if (record.isCorrect) {
            bucket.correct += 1;
        }
        bucket.totalMs += record.responseTimeMs;
        buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
        .map(([questionType, stats]) => ({
            questionType,
            label: QUESTION_TYPE_LABELS[questionType] ?? questionType,
            total: stats.total,
            correct: stats.correct,
            accuracy: Math.round((stats.correct / stats.total) * 100),
            avgResponseMs: Math.round(stats.totalMs / stats.total),
        }))
        .sort((a, b) => a.accuracy - b.accuracy);
}

export async function buildWeightedTypePicker(userId: string): Promise<() => QuestionType> {
    const weaknesses = await getUserWeaknessesRaw(userId);

    if (weaknesses.length === 0) {
        return () => PART5_QUESTION_TYPES[Math.floor(Math.random() * PART5_QUESTION_TYPES.length)];
    }

    const weightMap = new Map<string, number>();
    for (const weakness of weaknesses) {
        weightMap.set(weakness.questionType, Math.max(10, 100 - weakness.accuracy));
    }

    const pool = PART5_QUESTION_TYPES.map((type) => ({
        type,
        weight: weightMap.get(type) ?? 50,
    }));
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);

    return () => {
        let cursor = Math.random() * totalWeight;
        for (const item of pool) {
            cursor -= item.weight;
            if (cursor <= 0) return item.type;
        }
        return pool[0].type;
    };
}

export async function getRadarDataRaw(userId: string): Promise<DiagnosticRadarPayload> {
    const weaknesses = await getUserWeaknessesRaw(userId);

    if (weaknesses.length === 0) {
        return { radarData: [], weakest: null, totalAttempts: 0 };
    }

    return {
        radarData: weaknesses.map((weakness) => ({
            subject: weakness.label,
            A: weakness.accuracy,
            fullMark: 100,
        })),
        weakest: weaknesses[0],
        totalAttempts: weaknesses.reduce((sum, weakness) => sum + weakness.total, 0),
    };
}

export async function getWeakestGrammarNodesRaw(
    userId: string,
    limit = 3
): Promise<string[]> {
    const weakNodes = await db.userGrammarProficiency.findMany({
        where: {
            userId,
            masteryScore: { not: undefined },
            grammarNode: { level: 3 },
        },
        orderBy: { masteryScore: "asc" },
        take: limit,
        select: { grammarNodeId: true },
    });

    return weakNodes.map((node) => node.grammarNodeId).filter((id): id is string => id !== null);
}
