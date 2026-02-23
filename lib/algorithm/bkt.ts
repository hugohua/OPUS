/**
 * BKT (Bayesian Knowledge Tracing) 纯函数
 * 
 * 专为四选一题型设计，天然抗猜测噪声。
 * 零副作用、零依赖、纯数学计算。
 * 
 * 参考: docs/PRD-GRAMMAR-SKILL-TREE.md §4.2
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 常量：BKT 参数
// ---------------------------------------------------------------------------

/** 四选一蒙对率 */
const P_GUESS = 0.25;

/** 学习转移率：单次练习从"未掌握"到"掌握"的概率 */
const P_TRANSIT = 0.1;

/** 失误率映射表 (difficulty → P(S)) */
const SLIP_BY_DIFFICULTY: Record<number, number> = {
    1: 0.05,  // 简单题：掌握了几乎不会错
    2: 0.10,  // 中等题：偶尔粗心
    3: 0.15,  // 困难题：掌握了也可能因为复杂度而失误
};

/** 默认失误率 */
const DEFAULT_SLIP = 0.10;

/** 钳位边界：防止 masteryScore 卡死在 0 或 1 */
const CLAMP_MIN = 0.01;
const CLAMP_MAX = 0.99;

// ---------------------------------------------------------------------------
// 类型定义 + Zod 校验
// ---------------------------------------------------------------------------

export const BktStateSchema = z.object({
    masteryScore: z.number().min(0).max(1),
    exposureCount: z.number().int().min(0),
    correctCount: z.number().int().min(0),
});

export type BktState = z.infer<typeof BktStateSchema>;

export interface BktUpdateResult {
    newMasteryScore: number;
    newExposureCount: number;
    newCorrectCount: number;
}

// ---------------------------------------------------------------------------
// 核心函数
// ---------------------------------------------------------------------------

/**
 * 根据答题结果更新 BKT 状态
 * 
 * @param state    当前 BKT 状态 (masteryScore, exposureCount, correctCount)
 * @param isCorrect 本次答题是否正确
 * @param difficulty 题目难度 (1=Easy, 2=Medium, 3=Hard)，影响 P(S) 失误率
 * @returns 新的 BKT 状态
 */
export function updateBkt(
    state: BktState,
    isCorrect: boolean,
    difficulty: number = 2
): BktUpdateResult {
    // 1. 输入校验
    const validated = BktStateSchema.parse(state);
    const pL = clamp(validated.masteryScore, CLAMP_MIN, CLAMP_MAX);
    const pS = SLIP_BY_DIFFICULTY[difficulty] ?? DEFAULT_SLIP;

    // 2. 后验更新 (Posterior Update)
    let pLGivenEvidence: number;

    if (isCorrect) {
        // P(L|correct) = P(L)*(1-P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
        const numerator = pL * (1 - pS);
        const denominator = pL * (1 - pS) + (1 - pL) * P_GUESS;
        pLGivenEvidence = numerator / denominator;
    } else {
        // P(L|wrong) = P(L)*P(S) / [P(L)*P(S) + (1-P(L))*(1-P(G))]
        const numerator = pL * pS;
        const denominator = pL * pS + (1 - pL) * (1 - P_GUESS);
        pLGivenEvidence = numerator / denominator;
    }

    // 3. 学习转移 (Learning Transition)
    const pLNew = pLGivenEvidence + (1 - pLGivenEvidence) * P_TRANSIT;

    // 4. 钳位输出
    const clampedScore = clamp(pLNew, CLAMP_MIN, CLAMP_MAX);

    return {
        newMasteryScore: Math.round(clampedScore * 10000) / 10000, // 保留 4 位小数
        newExposureCount: validated.exposureCount + 1,
        newCorrectCount: validated.correctCount + (isCorrect ? 1 : 0),
    };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// 导出常量 (供测试使用)
// ---------------------------------------------------------------------------

export const BKT_PARAMS = {
    P_GUESS,
    P_TRANSIT,
    SLIP_BY_DIFFICULTY,
    CLAMP_MIN,
    CLAMP_MAX,
} as const;
