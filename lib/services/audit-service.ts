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
    | 'L2:CONTEXT';

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

// 导出配置状态（用于调试）
export function getAuditConfig() {
    return { ...AUDIT_CONFIG };
}
