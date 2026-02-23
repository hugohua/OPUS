/**
 * BKT 算法单元测试
 * 
 * 覆盖要求 (architecture-rules.md §7.B):
 *   - 100% 覆盖 lib/**\/*.ts
 *   - Happy Path / Edge Case / Sanitization
 */

import { describe, it, expect } from 'vitest';
import { updateBkt, BktState, BKT_PARAMS } from '../bkt';

// 辅助函数：连续答题 N 次
function simulateSequence(
    initial: BktState,
    answers: boolean[],
    difficulty: number = 2
): BktState {
    let state = { ...initial };
    for (const isCorrect of answers) {
        const result = updateBkt(state, isCorrect, difficulty);
        state = {
            masteryScore: result.newMasteryScore,
            exposureCount: result.newExposureCount,
            correctCount: result.newCorrectCount,
        };
    }
    return state;
}

describe('BKT Algorithm (updateBkt)', () => {

    // === Happy Path ===

    it('连续答对 3 次 → masteryScore 应从 0.5 升至 ≥ 0.85', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const result = simulateSequence(initial, [true, true, true]);

        expect(result.masteryScore).toBeGreaterThanOrEqual(0.85);
        expect(result.exposureCount).toBe(3);
        expect(result.correctCount).toBe(3);
    });

    it('连续答错 3 次 → masteryScore 应从 0.5 降至 ≤ 0.25', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const result = simulateSequence(initial, [false, false, false]);

        expect(result.masteryScore).toBeLessThanOrEqual(0.25);
        expect(result.exposureCount).toBe(3);
        expect(result.correctCount).toBe(0);
    });

    it('乱序混合答题 → 分数在 0.3~0.7 之间波动', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const result = simulateSequence(initial, [true, false, true, false, true]);

        expect(result.masteryScore).toBeGreaterThan(0.3);
        expect(result.masteryScore).toBeLessThan(0.7);
    });

    it('单次答对 → 分数上升', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 5, correctCount: 3 };
        const result = updateBkt(initial, true);

        expect(result.newMasteryScore).toBeGreaterThan(0.5);
        expect(result.newExposureCount).toBe(6);
        expect(result.newCorrectCount).toBe(4);
    });

    it('单次答错 → 分数下降', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 5, correctCount: 3 };
        const result = updateBkt(initial, false);

        expect(result.newMasteryScore).toBeLessThan(0.5);
        expect(result.newExposureCount).toBe(6);
        expect(result.newCorrectCount).toBe(3);
    });

    // === 审计修复 #4：difficulty 影响 P(S) 测试 ===

    it('difficulty=1 vs difficulty=3 → 高难度答错扣分更少', () => {
        const initial: BktState = { masteryScore: 0.7, exposureCount: 10, correctCount: 7 };

        const easyWrong = updateBkt(initial, false, 1);   // P(S)=0.05
        const hardWrong = updateBkt(initial, false, 3);   // P(S)=0.15

        // 高难度的失误率更高，说明"掌握了但出错"更可信，所以扣分应该更少
        expect(hardWrong.newMasteryScore).toBeGreaterThan(easyWrong.newMasteryScore);
    });

    it('difficulty=1 答对 vs difficulty=3 答对 → 简单题答对涨分更多', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 5, correctCount: 3 };

        const easyCorrect = updateBkt(initial, true, 1);  // P(S)=0.05 → (1-P(S))=0.95
        const hardCorrect = updateBkt(initial, true, 3);  // P(S)=0.15 → (1-P(S))=0.85

        // 简单题答对更能证明确实掌握（失误率低意味着不太可能是运气）
        expect(easyCorrect.newMasteryScore).toBeGreaterThan(hardCorrect.newMasteryScore);
    });

    // === 审计修复 #4：钳位边界测试 ===

    it('边界：masteryScore=0.01 答对 → 正常上升，不产生 NaN', () => {
        const initial: BktState = { masteryScore: 0.01, exposureCount: 20, correctCount: 2 };
        const result = updateBkt(initial, true);

        expect(result.newMasteryScore).toBeGreaterThan(0.01);
        expect(Number.isNaN(result.newMasteryScore)).toBe(false);
        expect(Number.isFinite(result.newMasteryScore)).toBe(true);
    });

    it('边界：masteryScore=0.99 答错 → 正常下降，不卡死在 0.99', () => {
        const initial: BktState = { masteryScore: 0.99, exposureCount: 50, correctCount: 48 };
        const result = updateBkt(initial, false);

        expect(result.newMasteryScore).toBeLessThan(0.99);
        expect(Number.isNaN(result.newMasteryScore)).toBe(false);
    });

    it('钳位：输出永远在 [0.01, 0.99] 区间', () => {
        // 极端场景：非常低的分连续答错
        const lowState: BktState = { masteryScore: 0.01, exposureCount: 100, correctCount: 5 };
        const resultLow = updateBkt(lowState, false);
        expect(resultLow.newMasteryScore).toBeGreaterThanOrEqual(BKT_PARAMS.CLAMP_MIN);

        // 极端场景：非常高的分连续答对
        const highState: BktState = { masteryScore: 0.99, exposureCount: 100, correctCount: 98 };
        const resultHigh = updateBkt(highState, true);
        expect(resultHigh.newMasteryScore).toBeLessThanOrEqual(BKT_PARAMS.CLAMP_MAX);
    });

    // === Sanitization ===

    it('输入校验：masteryScore 超出 [0,1] 范围应抛错', () => {
        expect(() => updateBkt({ masteryScore: -0.1, exposureCount: 0, correctCount: 0 }, true))
            .toThrow();
        expect(() => updateBkt({ masteryScore: 1.5, exposureCount: 0, correctCount: 0 }, true))
            .toThrow();
    });

    it('输入校验：负数 exposureCount 应抛错', () => {
        expect(() => updateBkt({ masteryScore: 0.5, exposureCount: -1, correctCount: 0 }, true))
            .toThrow();
    });

    it('默认 difficulty=2 → P(S)=0.10', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const withDefault = updateBkt(initial, true);
        const withExplicit = updateBkt(initial, true, 2);

        expect(withDefault.newMasteryScore).toBe(withExplicit.newMasteryScore);
    });

    it('未知 difficulty 值 → 使用默认 P(S)=0.10', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const withUnknown = updateBkt(initial, true, 99);
        const withDefault = updateBkt(initial, true, 2);

        expect(withUnknown.newMasteryScore).toBe(withDefault.newMasteryScore);
    });

    // === 精度测试 ===

    it('输出保留 4 位小数', () => {
        const initial: BktState = { masteryScore: 0.5, exposureCount: 0, correctCount: 0 };
        const result = updateBkt(initial, true);

        const decimalPlaces = (result.newMasteryScore.toString().split('.')[1] || '').length;
        expect(decimalPlaces).toBeLessThanOrEqual(4);
    });
});
