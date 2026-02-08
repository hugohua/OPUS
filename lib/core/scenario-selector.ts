/**
 * 混合模式场景选择器
 * 功能：
 *   根据 FSRS Stability 为混合模式选择合适的单一场景
 */

import { SessionMode, SingleScenarioMode } from '@/types/briefing';
import { STABILITY_THRESHOLDS as THRESHOLDS } from '@/lib/config/stability-thresholds';

// 混合模式场景映射
export const MIXED_MODE_SCENARIOS: Record<string, SingleScenarioMode[]> = {
    'L0_MIXED': ['SYNTAX', 'PHRASE', 'BLITZ'],
    'L1_MIXED': ['AUDIO', 'CHUNKING'],
    'L2_MIXED': ['CONTEXT', 'NUANCE'],
    'DAILY_BLITZ': ['SYNTAX', 'PHRASE', 'BLITZ', 'AUDIO', 'CHUNKING', 'CONTEXT', 'NUANCE']
};

/**
 * 根据 FSRS Stability 选择场景
 * 
 * 使用配置化阈值，支持动态调整和 A/B Testing
 */
export function selectScenario(
    stability: number,
    allowedScenarios: SingleScenarioMode[]
): SingleScenarioMode {
    if (allowedScenarios.length === 0) {
        throw new Error('Allowed scenarios cannot be empty');
    }

    // L0 场景选择（使用配置化阈值）
    if (allowedScenarios.includes('SYNTAX') && stability < THRESHOLDS.L0.SYNTAX_MAX) {
        return 'SYNTAX';
    }
    if (allowedScenarios.includes('PHRASE') &&
        stability >= THRESHOLDS.L0.SYNTAX_MAX &&
        stability < THRESHOLDS.L0.PHRASE_MAX) {
        return 'PHRASE';
    }
    if (allowedScenarios.includes('BLITZ') &&
        stability >= THRESHOLDS.L0.PHRASE_MAX &&
        stability < THRESHOLDS.L0.BLITZ_MAX) {
        return 'BLITZ';
    }

    // L1 场景选择（使用配置化阈值）
    if (allowedScenarios.includes('AUDIO') && stability < THRESHOLDS.L1.AUDIO_MAX) {
        return 'AUDIO';
    }
    if (allowedScenarios.includes('CHUNKING') &&
        stability >= THRESHOLDS.L1.AUDIO_MAX &&
        stability < THRESHOLDS.L1.CHUNKING_MAX) {
        return 'CHUNKING';
    }

    // L2 场景选择（使用配置化阈值）
    if (allowedScenarios.includes('CONTEXT') && stability < THRESHOLDS.L2.CONTEXT_MAX) {
        return 'CONTEXT';
    }
    if (allowedScenarios.includes('NUANCE') && stability >= THRESHOLDS.L2.CONTEXT_MAX) {
        return 'NUANCE';
    }

    // 兜底：返回允许场景列表的第一个
    return allowedScenarios[0];
}

/**
 * 检查是否为混合模式
 */
export function isMixedMode(mode: SessionMode): boolean {
    return mode in MIXED_MODE_SCENARIOS;
}
