/**
 * 全景审计服务 (Panoramic Audit Service)
 * 
 * 统一封装所有审计日志记录逻辑，提供：
 * - 环境变量开关控制
 * - 采样率控制（减少成本）
 * - 类型安全的记录接口
 * - 非阻塞写入
 * 
 * 配置项 (.env):
 * - AUDIT_ENABLED=true/false  # 总开关
 * - AUDIT_SAMPLE_RATE=100     # 采样率 (0-100%)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'audit-service' });

// 配置
const AUDIT_CONFIG = {
    enabled: process.env.AUDIT_ENABLED !== 'false', // 默认开启
    sampleRate: parseInt(process.env.AUDIT_SAMPLE_RATE || '100', 10), // 默认 100%
};

// 审计类型定义
export type AuditContextMode =
    | 'OMPS:SELECTION'
    | 'FSRS:TRANSITION'
    | 'L0:SYNTAX'
    | 'L0:BLITZ'
    | 'L0:PHRASE'
    | 'L0:NUANCE'
    | 'L1:AUDIO'
    | 'L2:CONTEXT'
    | 'WEAVER:SELECTION'
    | 'WAND:LOOKUP'
    | 'INVENTORY:FULL'
    | 'INVENTORY:ADD'
    | 'INVENTORY:CONSUME'
    | 'INVENTORY:TRIGGER'
    | 'LLM:FAILOVER';

export interface AuditPayload {
    context: Record<string, any>;
    decision?: Record<string, any>;
    drill?: any;
    generator?: {
        provider: string;
        mode: string;
        vocabId: number;
        type: string;
    };
}

export interface AuditRecordInput {
    targetWord: string;
    contextMode: AuditContextMode | string;
    userId?: string;
    payload: AuditPayload;
    auditTags?: string[];
    status?: 'PENDING' | 'GOOD' | 'BAD' | 'AUDIT';
}

/**
 * 记录审计日志（非阻塞）
 * 
 * 自动处理：
 * - 开关检查
 * - 采样率控制
 * - 错误捕获（不影响主流程）
 */
export function recordAudit(input: AuditRecordInput): void {
    // 1. 开关检查
    if (!AUDIT_CONFIG.enabled) {
        return;
    }

    // 2. 采样率控制
    if (AUDIT_CONFIG.sampleRate < 100) {
        const rand = Math.random() * 100;
        if (rand > AUDIT_CONFIG.sampleRate) {
            return; // 跳过此次记录
        }
    }

    // 3. 非阻塞写入
    void db.drillAudit?.create({
        data: {
            targetWord: input.targetWord,
            contextMode: input.contextMode,
            userId: input.userId,
            status: input.status || 'PENDING',
            payload: JSON.parse(JSON.stringify(input.payload)), // 确保 JSON 兼容
            auditTags: input.auditTags || []
        }
    }).catch(err => {
        log.error({ err, contextMode: input.contextMode }, 'Audit record failed');
    });
}

/**
 * 批量记录审计日志
 * 用于 LLM 批量生成场景
 */
export function recordAuditBatch(inputs: AuditRecordInput[]): void {
    if (!AUDIT_CONFIG.enabled) return;

    for (const input of inputs) {
        recordAudit(input);
    }
}

// ============================================
// 便捷方法：各链路专用
// ============================================

/**
 * OMPS 选词审计
 */
export function auditOMPSSelection(
    userId: string,
    context: {
        mode?: string;
        track: string;
        limit: number;
        excludeCount: number;
        reviewQuota: number;
    },
    decision: {
        hotCount: number;
        reviewCount: number;
        newCount: number;
        totalSelected: number;
        selectedIds: number[];
    }
): void {
    // 自动异常标记
    const auditTags: string[] = [];
    if (context.reviewQuota > 0 && decision.reviewCount === 0) {
        auditTags.push('review_ignored');
    }
    if (context.limit > 5 && decision.totalSelected < context.limit * 0.5) {
        auditTags.push('selection_shortage');
    }

    recordAudit({
        targetWord: `OMPS:${context.mode || 'DEFAULT'}`,
        contextMode: 'OMPS:SELECTION',
        userId,
        payload: { context, decision },
        auditTags
    });
}

/**
 * FSRS 状态跃迁审计
 */
export function auditFSRSTransition(
    userId: string,
    context: {
        vocabId: number;
        mode: string;
        track: string;
        prevState: number;
        prevStability: number;
        grade: number;
        gradeLabel?: string;
        reps?: number;
    },
    decision: {
        newState: number;
        newStability: number;
        scheduledDays: number;
        masteryChange?: any;
    },
    options?: {
        extraTags?: string[];
    }
): void {
    // 自动异常标记
    const auditTags: string[] = options?.extraTags || [];

    if (context.grade === 1 && (context.reps ?? 0) > 5) {
        auditTags.push('repeated_failure');
    }
    if (decision.newStability < context.prevStability) {
        auditTags.push('stability_drop');
    }

    recordAudit({
        targetWord: String(context.vocabId),
        contextMode: 'FSRS:TRANSITION',
        userId,
        payload: { context, decision },
        auditTags
    });
}

/**
 * LLM 生成审计
 */
export function auditLLMGeneration(
    userId: string,
    mode: string,
    targetWord: string,
    drill: any,
    generator: {
        provider: string;
        vocabId: number;
        type: string;
    },
    options?: {
        isPivotFallback?: boolean;
    }
): void {
    // 根据 mode 确定 contextMode
    const contextMode = mode === 'AUDIO' ? 'L1:AUDIO' :
        mode === 'CONTEXT' ? 'L2:CONTEXT' :
            `L0:${mode}`;

    const auditTags: string[] = [];
    if (options?.isPivotFallback) {
        auditTags.push('pivot_fallback');
    }

    recordAudit({
        targetWord,
        contextMode,
        userId,
        payload: {
            context: {},
            drill,
            generator: {
                ...generator,
                mode
            }
        },
        auditTags
    });
}

/**
 * LLM Provider Failover 审计
 * 记录 Provider 切换事件，便于追踪不稳定的 Provider
 */
export function auditLLMFailover(
    userId: string | null, // 新增：可选的用户 ID，用于审计追溯
    failedProvider: string,
    fallbackProvider: string | null,
    error: string,
    context: {
        mode: 'fast' | 'smart';
        attemptNumber: number;
        totalProviders: number;
    }
): void {
    const auditTags: string[] = ['provider_failover'];

    // 标记是否全部失败
    if (!fallbackProvider) {
        auditTags.push('all_providers_failed');
    }

    // 标记连续失败
    if (context.attemptNumber > 1) {
        auditTags.push('multi_failover');
    }

    recordAudit({
        targetWord: `LLM:${context.mode.toUpperCase()}`,
        contextMode: 'LLM:FAILOVER',
        status: fallbackProvider ? 'PENDING' : 'BAD',
        payload: {
            context: {
                mode: context.mode,
                attemptNumber: context.attemptNumber,
                totalProviders: context.totalProviders,
                userId // 包含用户 ID 供后续追溯
            },
            decision: {
                failedProvider,
                fallbackProvider,
                errorMessage: error.slice(0, 500) // 限制错误信息长度
            }
        },
        auditTags
    });
}


/**
 * [Session Layer] 记录确定性兜底 (Cache Miss)
 */
export function auditSessionFallback(
    userId: string,
    mode: string,
    vocabId: number,
    targetWord: string
) {
    recordAudit({
        targetWord: targetWord,
        contextMode: `${mode}:FALLBACK`, // Special mode for easy filtering
        userId,
        status: 'BAD', // Fallback is inherently suboptimal
        auditTags: ['session_fallback'],
        payload: {
            context: {
                reason: 'cache_miss',
                vocabId
            }
        }
    });
}


/**
 * Weaver Selection 审计
 * 记录 Priority Queue 和 Filler Queue 的构成
 */
export function auditWeaverSelection(
    userId: string,
    scenario: string,
    inputs: {
        priorityCount: number;
        fillerCount: number;
        priorityIds: number[];
        fillerIds: number[];
    }
): void {
    // ✅ User ID 校验
    if (!userId || userId.trim() === '') {
        log.warn('[AuditService] Invalid userId for WEAVER:SELECTION, skipping audit');
        return;
    }

    const auditTags: string[] = [];
    if (inputs.priorityCount === 0) auditTags.push('weaver_starved');

    recordAudit({
        targetWord: `WEAVER:${scenario.toUpperCase()}`,
        contextMode: 'WEAVER:SELECTION',
        userId,
        payload: {
            context: { scenario },
            decision: inputs
        },
        auditTags
    });
}

/**
 * Magic Wand 查词审计
 * 记录用户查词意图
 */
export function auditWandLookup(
    userId: string,
    word: string,
    contextId?: string,
    result?: {
        vocabId: number;
        found: boolean;
    }
): void {
    // ✅ User ID 校验 + 词汇长度限制
    if (!userId || userId.trim() === '') {
        log.warn('[AuditService] Invalid userId for WAND:LOOKUP, skipping audit');
        return;
    }

    // ✅ W2: 限制词汇长度为 100 字符
    const sanitizedWord = word.trim().slice(0, 100);

    recordAudit({
        targetWord: sanitizedWord,
        contextMode: 'WAND:LOOKUP',
        userId,
        payload: {
            context: { contextId },
            decision: result
        },
        // 如果是从 Generate 页面查词，标记为 contextual_lookup
        auditTags: contextId ? ['contextual_lookup'] : ['direct_lookup']
    });
}

/**
 * 库存事件类型
 */
export type InventoryEventType =
    | 'FULL'      // 库存满拒绝生成
    | 'ADD'       // 入库成功
    | 'CONSUME'   // 库存消费
    | 'TRIGGER';  // 手动触发

/**
 * 库存事件审计
 * 追踪库存管理链路的关键事件
 */
export function auditInventoryEvent(
    userId: string,
    eventType: InventoryEventType,
    mode: string,
    context: {
        currentCount: number;
        capacity: number;
        delta?: number;
        source?: 'auto' | 'manual' | 'emergency';
        vocabId?: number; // W2 Fix: 消费时记录具体词汇 ID
    }
): void {
    const auditTags: string[] = [];

    // 自动标记
    if (eventType === 'FULL') {
        auditTags.push('inventory_blocked');
    }
    if (context.source === 'manual') {
        auditTags.push('manual_trigger');
    }
    if (context.currentCount > context.capacity) {
        auditTags.push('over_capacity');
    }

    recordAudit({
        targetWord: `INVENTORY:${mode}`,
        contextMode: `INVENTORY:${eventType}`,
        userId,
        payload: { context },
        auditTags
    });
}

// 导出配置状态（用于调试）
export function getAuditConfig() {
    return { ...AUDIT_CONFIG };
}

