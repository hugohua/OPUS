/**
 * Stability 阈值配置
 * Single Source of Truth for Scenario Selection Thresholds
 * 
 * 用途：
 *   - 统一管理场景选择的 Stability 阈值
 *   - 支持 A/B Testing 和动态调整
 *   - 便于监控和分析优化
 */

/**
 * L0 场景阈值配置
 */
export const L0_THRESHOLDS = {
    SYNTAX_MAX: 7,      // < 7: SYNTAX (语法强化)
    PHRASE_MAX: 21,     // 7-21: PHRASE (短语应用)
    BLITZ_MAX: 45       // 21-45: BLITZ (快速复习)
    // >= 45: 超出 L0 范围
} as const;

/**
 * L1 场景阈值配置
 */
export const L1_THRESHOLDS = {
    AUDIO_MAX: 14,      // < 14: AUDIO (听力训练)
    CHUNKING_MAX: 45    // 14-45: CHUNKING (语义切分)
    // >= 45: 超出 L1 范围
} as const;

/**
 * L2 场景阈值配置
 */
export const L2_THRESHOLDS = {
    CONTEXT_MAX: 45     // < 45: CONTEXT (情境应用)
    // >= 45: NUANCE (商务语感)
} as const;

/**
 * 完整阈值配置导出
 */
export const STABILITY_THRESHOLDS = {
    L0: L0_THRESHOLDS,
    L1: L1_THRESHOLDS,
    L2: L2_THRESHOLDS
} as const;

/**
 * 阈值设计说明
 * 
 * L0 分层逻辑：
 *   - Stability < 7: 词汇非常不稳定，需要语法强化训练（SYNTAX）
 *   - 7 ≤ Stability < 21: 基本掌握，进行短语应用训练（PHRASE）
 *   - 21 ≤ Stability < 45: 较为熟练，使用快速复习巩固（BLITZ）
 * 
 * L1 分层逻辑：
 *   - Stability < 14: 听力识别阶段（AUDIO）
 *   - 14 ≤ Stability < 45: 语义理解阶段（CHUNKING）
 * 
 * L2 分层逻辑：
 *   - Stability < 45: 情境应用阶段（CONTEXT）
 *   - Stability ≥ 45: 商务语感阶段（NUANCE）
 * 
 * 上限设计理由：
 *   - L0/L1 上限设置为 45，避免与 L2 场景重叠
 *   - L2 无上限，支持高熟练度训练
 */
