/**
 * Scenario Selector 单元测试
 * 测试混合模式场景选择逻辑
 */

import { describe, it, expect } from 'vitest';
import {
    selectScenario,
    isMixedMode,
    MIXED_MODE_SCENARIOS
} from '@/lib/core/scenario-selector';
import type { SingleScenarioMode, SessionMode } from '@/types/briefing';

describe('Scenario Selector', () => {
    describe('L0 场景选择 (SYNTAX, PHRASE, BLITZ)', () => {
        const L0_SCENARIOS: SingleScenarioMode[] = ['SYNTAX', 'PHRASE', 'BLITZ'];

        it('stability < 7 应选择 SYNTAX', () => {
            expect(selectScenario(0, L0_SCENARIOS)).toBe('SYNTAX');
            expect(selectScenario(3.5, L0_SCENARIOS)).toBe('SYNTAX');
            expect(selectScenario(6.9, L0_SCENARIOS)).toBe('SYNTAX');
        });

        it('7 ≤ stability < 21 应选择 PHRASE', () => {
            expect(selectScenario(7, L0_SCENARIOS)).toBe('PHRASE');
            expect(selectScenario(14, L0_SCENARIOS)).toBe('PHRASE');
            expect(selectScenario(20.9, L0_SCENARIOS)).toBe('PHRASE');
        });

        it('stability ≥ 21 应选择 BLITZ', () => {
            expect(selectScenario(21, L0_SCENARIOS)).toBe('BLITZ');
            expect(selectScenario(35, L0_SCENARIOS)).toBe('BLITZ');
            // stability = 100 超出 L0 范围，回退到第一个（SYNTAX）
            expect(selectScenario(100, L0_SCENARIOS)).toBe('SYNTAX');
        });

        it('边界值测试', () => {
            expect(selectScenario(7.0, L0_SCENARIOS)).toBe('PHRASE');
            expect(selectScenario(21.0, L0_SCENARIOS)).toBe('BLITZ');
        });
    });

    describe('L1 场景选择 (AUDIO, CHUNKING)', () => {
        const L1_SCENARIOS: SingleScenarioMode[] = ['AUDIO', 'CHUNKING'];

        it('stability < 14 应选择 AUDIO', () => {
            expect(selectScenario(0, L1_SCENARIOS)).toBe('AUDIO');
            expect(selectScenario(7, L1_SCENARIOS)).toBe('AUDIO');
            expect(selectScenario(13.9, L1_SCENARIOS)).toBe('AUDIO');
        });

        it('stability ≥ 14 应选择 CHUNKING', () => {
            expect(selectScenario(14, L1_SCENARIOS)).toBe('CHUNKING');
            expect(selectScenario(21, L1_SCENARIOS)).toBe('CHUNKING');
            // stability = 45 超出 L1 范围，回退到第一个（AUDIO）
            expect(selectScenario(45, L1_SCENARIOS)).toBe('AUDIO');
        });

        it('边界值测试', () => {
            expect(selectScenario(14.0, L1_SCENARIOS)).toBe('CHUNKING');
        });
    });

    describe('L2 场景选择 (CONTEXT, NUANCE)', () => {
        const L2_SCENARIOS: SingleScenarioMode[] = ['CONTEXT', 'NUANCE'];

        it('stability < 45 应选择 CONTEXT', () => {
            expect(selectScenario(0, L2_SCENARIOS)).toBe('CONTEXT');
            expect(selectScenario(21, L2_SCENARIOS)).toBe('CONTEXT');
            expect(selectScenario(44.9, L2_SCENARIOS)).toBe('CONTEXT');
        });

        it('stability ≥ 45 应选择 NUANCE', () => {
            expect(selectScenario(45, L2_SCENARIOS)).toBe('NUANCE');
            expect(selectScenario(100, L2_SCENARIOS)).toBe('NUANCE');
        });

        it('边界值测试', () => {
            expect(selectScenario(45.0, L2_SCENARIOS)).toBe('NUANCE');
        });
    });

    describe('DAILY_BLITZ 全场景选择', () => {
        const ALL_SCENARIOS: SingleScenarioMode[] = [
            'SYNTAX', 'PHRASE', 'BLITZ',
            'AUDIO', 'CHUNKING',
            'CONTEXT', 'NUANCE'
        ];

        it('应根据 Stability 选择正确的场景', () => {
            expect(selectScenario(3, ALL_SCENARIOS)).toBe('SYNTAX');
            expect(selectScenario(10, ALL_SCENARIOS)).toBe('PHRASE');
            expect(selectScenario(25, ALL_SCENARIOS)).toBe('BLITZ');
            expect(selectScenario(50, ALL_SCENARIOS)).toBe('NUANCE');
        });

        it('边界情况：L0 优先于 L1', () => {
            // stability = 7，匹配 L0 PHRASE 和 L1 AUDIO，应选择 L0
            expect(selectScenario(7, ALL_SCENARIOS)).toBe('PHRASE');
        });

        it('边界情况：stability = 14 的选择', () => {
            // stability = 14，匹配 L0 PHRASE (7-21) 和 L1 CHUNKING (14-45)
            // L0 先检查，所以选择 PHRASE
            expect(selectScenario(14, ALL_SCENARIOS)).toBe('PHRASE');
        });
    });

    describe('边缘情况处理', () => {
        it('空数组应抛出错误', () => {
            expect(() => selectScenario(10, [])).toThrow('Allowed scenarios cannot be empty');
        });

        it('无匹配场景时返回第一个', () => {
            // 如果只有 AUDIO，但 stability >= 14（应该选 CHUNKING），兜底返回 AUDIO
            expect(selectScenario(20, ['AUDIO'])).toBe('AUDIO');
        });

        it('负数 Stability 应正常工作', () => {
            const L0_SCENARIOS: SingleScenarioMode[] = ['SYNTAX', 'PHRASE', 'BLITZ'];
            expect(selectScenario(-1, L0_SCENARIOS)).toBe('SYNTAX');
        });

        it('极大 Stability 值', () => {
            const L2_SCENARIOS: SingleScenarioMode[] = ['CONTEXT', 'NUANCE'];
            expect(selectScenario(10000, L2_SCENARIOS)).toBe('NUANCE');
        });
    });

    describe('isMixedMode 辅助函数', () => {
        it('应正确识别混合模式', () => {
            expect(isMixedMode('L0_MIXED' as SessionMode)).toBe(true);
            expect(isMixedMode('L1_MIXED' as SessionMode)).toBe(true);
            expect(isMixedMode('L2_MIXED' as SessionMode)).toBe(true);
            expect(isMixedMode('DAILY_BLITZ' as SessionMode)).toBe(true);
        });

        it('应正确拒绝单一模式', () => {
            expect(isMixedMode('SYNTAX' as SessionMode)).toBe(false);
            expect(isMixedMode('PHRASE' as SessionMode)).toBe(false);
            expect(isMixedMode('AUDIO' as SessionMode)).toBe(false);
            expect(isMixedMode('CONTEXT' as SessionMode)).toBe(false);
        });
    });

    describe('MIXED_MODE_SCENARIOS 映射表', () => {
        it('L0_MIXED 应包含 L0 场景', () => {
            expect(MIXED_MODE_SCENARIOS['L0_MIXED']).toEqual(['SYNTAX', 'PHRASE', 'BLITZ']);
        });

        it('L1_MIXED 应包含 L1 场景', () => {
            expect(MIXED_MODE_SCENARIOS['L1_MIXED']).toEqual(['AUDIO', 'CHUNKING']);
        });

        it('L2_MIXED 应包含 L2 场景', () => {
            expect(MIXED_MODE_SCENARIOS['L2_MIXED']).toEqual(['CONTEXT', 'NUANCE']);
        });

        it('DAILY_BLITZ 应包含全部场景', () => {
            expect(MIXED_MODE_SCENARIOS['DAILY_BLITZ']).toEqual([
                'SYNTAX', 'PHRASE', 'BLITZ',
                'AUDIO', 'CHUNKING',
                'CONTEXT', 'NUANCE'
            ]);
        });
    });
});
