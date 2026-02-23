/**
 * 诊断服务 (Diagnostic Service)
 * 
 * 功能：
 *   - 从 AttemptRecord 聚合用户各 QuestionType 的表现
 *   - 构建加权选题函数，供 Worker 和 Brain 复用
 * 
 * 注意：
 *   - 本文件不含 'use server'，可在 Worker 和 Next.js 中通用
 *   - 使用 db (Prisma) 直接查询
 */

import { db } from '@/lib/db';
import { QuestionType } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface WeaknessProfile {
    questionType: string;
    label: string;
    total: number;
    correct: number;
    accuracy: number;        // 0-100
    avgResponseMs: number;
}

export interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
    MORPHOLOGY: '词形变换',
    COLLOCATION: '词组搭配',
    GRAMMAR: '基础语法',
    SYNONYM: '近义辨析',
    PHRASAL_VERB: '动词短语',
    PRONOUN_REFERENCE: '代词指代',
};

// 6 种 ETS 标准题型
const ALL_QUESTION_TYPES: QuestionType[] = [
    'MORPHOLOGY', 'PHRASAL_VERB', 'PRONOUN_REFERENCE',
    'GRAMMAR', 'COLLOCATION', 'SYNONYM'
];

// --------------------------------------------------------------------------
// 1. getUserWeaknessesRaw — 纯数据库查询，无 auth 校验
// --------------------------------------------------------------------------
export async function getUserWeaknessesRaw(
    userId: string,
    recentLimit = 100
): Promise<WeaknessProfile[]> {
    const records = await db.attemptRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: recentLimit,
        select: {
            questionType: true,
            isCorrect: true,
            responseTimeMs: true,
        },
    });

    if (records.length === 0) return [];

    // 按 questionType 聚合
    const map = new Map<string, { total: number; correct: number; totalMs: number }>();
    for (const r of records) {
        const key = r.questionType;
        if (!map.has(key)) map.set(key, { total: 0, correct: 0, totalMs: 0 });
        const bucket = map.get(key)!;
        bucket.total++;
        if (r.isCorrect) bucket.correct++;
        bucket.totalMs += r.responseTimeMs;
    }

    const result: WeaknessProfile[] = [];
    for (const [qt, stats] of map.entries()) {
        result.push({
            questionType: qt,
            label: QUESTION_TYPE_LABELS[qt] || qt,
            total: stats.total,
            correct: stats.correct,
            accuracy: Math.round((stats.correct / stats.total) * 100),
            avgResponseMs: Math.round(stats.totalMs / stats.total),
        });
    }

    result.sort((a, b) => a.accuracy - b.accuracy);
    return result;
}

// --------------------------------------------------------------------------
// 2. buildWeightedTypePicker — 返回加权随机选择函数
// --------------------------------------------------------------------------
export async function buildWeightedTypePicker(
    userId: string
): Promise<() => QuestionType> {
    const weaknesses = await getUserWeaknessesRaw(userId);

    // 冷启动：无答题数据时返回均匀随机
    if (weaknesses.length === 0) {
        return () => ALL_QUESTION_TYPES[Math.floor(Math.random() * ALL_QUESTION_TYPES.length)];
    }

    // 构建加权池：正确率越低 → 权重越高（反转）
    const weightMap = new Map<string, number>();
    for (const w of weaknesses) {
        weightMap.set(w.questionType, Math.max(10, 100 - w.accuracy));
    }

    const pool = ALL_QUESTION_TYPES.map(t => ({
        type: t,
        weight: weightMap.get(t) ?? 50, // 无数据的题型给中等权重
    }));

    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);

    return () => {
        let r = Math.random() * totalWeight;
        for (const p of pool) {
            r -= p.weight;
            if (r <= 0) return p.type;
        }
        return pool[0].type;
    };
}

// --------------------------------------------------------------------------
// 3. getRadarDataRaw — 雷达图数据（无 auth）
// --------------------------------------------------------------------------
export async function getRadarDataRaw(userId: string): Promise<{
    radarData: RadarDataPoint[];
    weakest: WeaknessProfile | null;
    totalAttempts: number;
}> {
    const weaknesses = await getUserWeaknessesRaw(userId);

    if (weaknesses.length === 0) {
        return { radarData: [], weakest: null, totalAttempts: 0 };
    }

    const totalAttempts = weaknesses.reduce((sum, w) => sum + w.total, 0);
    const radarData = weaknesses.map(w => ({
        subject: w.label,
        A: w.accuracy,
        fullMark: 100,
    }));

    return {
        radarData,
        weakest: weaknesses[0],
        totalAttempts,
    };
}
