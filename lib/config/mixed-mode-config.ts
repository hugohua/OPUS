/**
 * 混合模式公共配置
 * Single Source of Truth for Mixed Mode Defaults
 * 
 * 用途：
 *   为所有使用 Record<SessionMode, T> 的地方提供统一的混合模式默认值
 *   避免在多个文件中重复定义混合模式配置
 */

import type { SessionMode } from '@/types/briefing';

/**
 * 混合模式默认配置值
 * 混合模式不直接使用这些配置，而是动态选择单一场景
 * 因此这些值通常为 0 或合理的兜底值
 */
export const MIXED_MODE_DEFAULTS = {
    L0_MIXED: 0,
    L1_MIXED: 0,
    L2_MIXED: 0,
    DAILY_BLITZ: 0
} as const;

/**
 * 创建完整的 SessionMode Record
 * 
 * @param singleModeConfig - 单一模式的配置对象
 * @param mixedModeOverride - 可选的混合模式覆盖值
 * @returns 完整的 SessionMode 配置
 * 
 * @example
 * ```typescript
 * const cache = createSessionModeRecord({
 *   SYNTAX: 5,
 *   PHRASE: 5,
 *   // ... 其他单一模式
 * });
 * ```
 */
export function createSessionModeRecord<T>(
    singleModeConfig: Record<string, T>,
    mixedModeOverride?: Partial<typeof MIXED_MODE_DEFAULTS>
): Record<SessionMode, T> {
    return {
        ...singleModeConfig,
        ...MIXED_MODE_DEFAULTS,
        ...mixedModeOverride
    } as Record<SessionMode, T>;
}

/**
 * 检查某个 mode 是否为混合模式
 * （向后兼容 scenario-selector.ts 中的 isMixedMode）
 */
export function isMixedSessionMode(mode: SessionMode): boolean {
    return mode in MIXED_MODE_DEFAULTS;
}

/**
 * 获取所有混合模式的键
 */
export function getMixedModeKeys(): Array<keyof typeof MIXED_MODE_DEFAULTS> {
    return Object.keys(MIXED_MODE_DEFAULTS) as Array<keyof typeof MIXED_MODE_DEFAULTS>;
}
