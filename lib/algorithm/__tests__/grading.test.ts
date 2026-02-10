import { describe, it, expect } from 'vitest';
import { calculateImplicitGrade, GRADING_THRESHOLDS } from '../grading';

describe('calculateImplicitGrade', () => {
    // ============================================
    // Branch 1: inputGrade === 1 → Always Again (1)
    // ============================================
    describe('显式忘记 (inputGrade=1)', () => {
        it('无论速度多快都返回 Again(1)', () => {
            expect(calculateImplicitGrade(1, 100, false, 'SYNTAX')).toBe(1);
        });

        it('重试状态下也返回 Again(1)', () => {
            expect(calculateImplicitGrade(1, 100, true, 'SYNTAX')).toBe(1);
        });

        it('慢答也返回 Again(1)', () => {
            expect(calculateImplicitGrade(1, 99999, false, 'SYNTAX')).toBe(1);
        });
    });

    // ============================================
    // Branch 2: isRetry → Always Good (3)
    // ============================================
    describe('重试修正 (isRetry=true)', () => {
        it('重试后强制 Good(3)，不受速度影响', () => {
            // 即使答得很快，重试也只给 Good，防止短期记忆被误判为高稳定性
            expect(calculateImplicitGrade(3, 100, true, 'SYNTAX')).toBe(3);
        });

        it('重试后慢答也是 Good(3)', () => {
            expect(calculateImplicitGrade(3, 99999, true, 'SYNTAX')).toBe(3);
        });

        it('不同模式下重试均为 Good(3)', () => {
            expect(calculateImplicitGrade(3, 500, true, 'PHRASE')).toBe(3);
            expect(calculateImplicitGrade(3, 500, true, 'CONTEXT')).toBe(3);
            expect(calculateImplicitGrade(3, 500, true, 'BLITZ')).toBe(3);
        });
    });

    // ============================================
    // Branch 3: Time-based grading (no retry, grade=3)
    // ============================================
    describe('SYNTAX 模式时间梯度 (easy=2500ms, hard=8000ms)', () => {
        const mode = 'SYNTAX' as const;

        it('极快 (<2500ms) → Easy(4)', () => {
            expect(calculateImplicitGrade(3, 1000, false, mode)).toBe(4);
            expect(calculateImplicitGrade(3, 2499, false, mode)).toBe(4);
        });

        it('边界值: 恰好等于 easy 阈值 → Good(3)', () => {
            // duration < easy 才是 Easy，等于时不满足 < 条件
            expect(calculateImplicitGrade(3, 2500, false, mode)).toBe(3);
        });

        it('正常速度 (2500-8000ms) → Good(3)', () => {
            expect(calculateImplicitGrade(3, 5000, false, mode)).toBe(3);
        });

        it('边界值: 恰好等于 hard 阈值 → Good(3)', () => {
            // duration > hard 才是 Hard，等于时不满足 > 条件
            expect(calculateImplicitGrade(3, 8000, false, mode)).toBe(3);
        });

        it('很慢 (>8000ms) → Hard(2)', () => {
            expect(calculateImplicitGrade(3, 8001, false, mode)).toBe(2);
            expect(calculateImplicitGrade(3, 20000, false, mode)).toBe(2);
        });
    });

    describe('PHRASE 模式时间梯度 (easy=1000ms, hard=3000ms)', () => {
        const mode = 'PHRASE' as const;

        it('极快 (<1000ms) → Easy(4)', () => {
            expect(calculateImplicitGrade(3, 500, false, mode)).toBe(4);
        });

        it('正常速度 → Good(3)', () => {
            expect(calculateImplicitGrade(3, 2000, false, mode)).toBe(3);
        });

        it('很慢 (>3000ms) → Hard(2)', () => {
            expect(calculateImplicitGrade(3, 4000, false, mode)).toBe(2);
        });
    });

    describe('CONTEXT 模式时间梯度 (easy=5000ms, hard=15000ms)', () => {
        const mode = 'CONTEXT' as const;

        it('极快 (<5000ms) → Easy(4)', () => {
            expect(calculateImplicitGrade(3, 3000, false, mode)).toBe(4);
        });

        it('正常速度 → Good(3)', () => {
            expect(calculateImplicitGrade(3, 10000, false, mode)).toBe(3);
        });

        it('很慢 (>15000ms) → Hard(2)', () => {
            expect(calculateImplicitGrade(3, 20000, false, mode)).toBe(2);
        });
    });

    // ============================================
    // Branch priority: Grade=1 > Retry > Duration
    // ============================================
    describe('分支优先级', () => {
        it('Grade=1 优先于 Retry', () => {
            // inputGrade=1 + isRetry=true → 应该返回 1 (Again)，不是 3 (Good)
            expect(calculateImplicitGrade(1, 500, true, 'SYNTAX')).toBe(1);
        });

        it('Retry 优先于 Duration', () => {
            // isRetry=true + 极快答题 → 应该返回 3 (Good)，不是 4 (Easy)
            expect(calculateImplicitGrade(3, 100, true, 'SYNTAX')).toBe(3);
        });
    });

    // ============================================
    // GRADING_THRESHOLDS export validation
    // ============================================
    describe('阈值配置完整性', () => {
        const expectedModes = [
            'SYNTAX', 'PHRASE', 'CONTEXT', 'CHUNKING',
            'NUANCE', 'BLITZ', 'AUDIO', 'READING', 'VISUAL'
        ];

        it('所有 SessionMode 都有对应阈值', () => {
            for (const mode of expectedModes) {
                expect(GRADING_THRESHOLDS[mode as keyof typeof GRADING_THRESHOLDS]).toBeDefined();
                expect(GRADING_THRESHOLDS[mode as keyof typeof GRADING_THRESHOLDS].easy).toBeGreaterThan(0);
                expect(GRADING_THRESHOLDS[mode as keyof typeof GRADING_THRESHOLDS].hard).toBeGreaterThan(0);
            }
        });

        it('DEFAULT 兜底阈值存在', () => {
            expect(GRADING_THRESHOLDS.DEFAULT).toBeDefined();
            expect(GRADING_THRESHOLDS.DEFAULT.easy).toBe(1500);
            expect(GRADING_THRESHOLDS.DEFAULT.hard).toBe(5000);
        });

        it('easy 始终小于 hard（逻辑一致性）', () => {
            for (const mode of [...expectedModes, 'DEFAULT'] as const) {
                const thresholds = GRADING_THRESHOLDS[mode as keyof typeof GRADING_THRESHOLDS];
                expect(thresholds.easy).toBeLessThan(thresholds.hard);
            }
        });
    });
});
