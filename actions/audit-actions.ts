'use server';

/**
 * Audit Actions - 审计数据的统一入口
 * 
 * 职责:
 * 1. 保存人工/AI 审计结果到数据库
 * 2. 提供反例回捞接口 (用于未来 Prompt 注入)
 */

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type AuditStatus = 'GOOD' | 'BAD' | 'AUDIT' | 'PENDING';

export type FlagReason =
    | 'HALLUCINATION'      // AI 幻觉 (编造不存在的内容)
    | 'LOGIC_ERROR'        // 逻辑错误 (答案与题干不匹配)
    | 'FORMAT_ISSUE'       // 格式问题 (JSON 结构不正确)
    | 'DIFFICULTY_MISMATCH' // 难度不匹配 (太简单/太难)
    | 'GRAMMATICAL_ERROR'  // 语法错误
    | 'OTHER';             // 其他

export interface CreateAuditRecordInput {
    targetWord: string;
    contextMode: string;  // e.g., "L0:SYNTAX", "L0:BLITZ"
    payload: any;
    status: AuditStatus;
    auditScore?: number;
    auditReason?: string;
    flagReason?: FlagReason | string;
    isRedundant?: boolean;
}

// ----------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------

/**
 * 创建审计记录 (通用入口)
 * 
 * 使用场景:
 * - Worker 自动保存生成结果 (status='PENDING')
 * - Admin 手动标记 Good/Bad Case
 * - AI Audit 自动评分
 */
export async function createAuditRecord(data: CreateAuditRecordInput) {
    try {
        const record = await prisma.drillAudit.create({
            data: {
                targetWord: data.targetWord,
                contextMode: data.contextMode,
                payload: data.payload,
                status: data.status,
                auditScore: data.auditScore,
                auditReason: data.auditReason,
                flagReason: data.flagReason,
                isRedundant: data.isRedundant ?? false
            }
        });

        // 如果是 Admin 页面触发的，刷新缓存
        revalidatePath('/admin/inspector');

        return { success: true, id: record.id };
    } catch (error) {
        console.error('Failed to create audit record:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * 获取反例样本 (用于 Prompt 注入)
 * 
 * @param mode - 模式标识，如 "L0:SYNTAX"
 * @param limit - 返回数量上限 (默认 3)
 * @returns 最近的 Bad Case 列表 (精简字段)
 */
export async function getNegativeExamples(mode: string, limit = 3) {
    try {
        const badCases = await prisma.drillAudit.findMany({
            where: {
                contextMode: mode,
                status: 'BAD',
                flagReason: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                targetWord: true,
                flagReason: true,
                // 只返回必要字段，减少 Token 消耗
                // 完整 payload 太大，不适合注入 Prompt
            }
        });

        return { success: true, data: badCases };
    } catch (error) {
        console.error('Failed to fetch negative examples:', error);
        return { success: false, data: [], error: String(error) };
    }
}

/**
 * 获取审计统计 (Dashboard 用)
 */
export async function getAuditStats() {
    try {
        const [total, good, bad, audit] = await Promise.all([
            prisma.drillAudit.count(),
            prisma.drillAudit.count({ where: { status: 'GOOD' } }),
            prisma.drillAudit.count({ where: { status: 'BAD' } }),
            prisma.drillAudit.count({ where: { status: 'AUDIT' } })
        ]);

        return {
            success: true,
            data: { total, good, bad, audit }
        };
    } catch (error) {
        console.error('Failed to get audit stats:', error);
        return { success: false, error: String(error) };
    }
}
