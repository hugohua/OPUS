'use server';

/**
 * Inspector Actions - Admin Inspector 专用
 * 
 * 职责:
 * 1. saveBadCase: 人工标记 Bad Case (复用 audit-actions)
 * 2. auditDrillQuality: AI 自动评审 (使用 quality-auditor Prompt)
 */

import { AIService } from '@/lib/ai/core';
import { createAuditRecord } from '@/actions/audit-actions';
import {
    AUDIT_SYSTEM_PROMPT,
    getAuditUserPrompt,
    AuditResult,
    AuditResultSchema
} from '@/lib/generators/audit/quality-auditor';

// Re-export for UI
export type { AuditResult } from '@/lib/generators/audit/quality-auditor';

// ----------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------

/**
 * 人工标记 Bad Case
 */
export async function saveBadCase(record: {
    id: string;
    targetWord: string;
    promptConstraints?: string;
    output: any;
    reason: string;
}) {
    return createAuditRecord({
        targetWord: record.targetWord,
        contextMode: record.promptConstraints || 'UNKNOWN',
        payload: record.output,
        status: 'BAD',
        flagReason: record.reason
    });
}

/**
 * AI 自动评审 Drill Card 质量
 * 
 * 使用 lib/generators/audit/quality-auditor.ts 的 Prompt
 */
export async function auditDrillQuality(
    targetWord: string,
    contextMode: string,
    payload: any
) {
    console.log('[Audit] Starting audit for:', targetWord);
    try {
        const segments = payload.segments || [];
        const interaction = segments.find((s: any) => s.type === 'interaction');

        if (!interaction) {
            console.error('[Audit] No interaction found');
            return { success: false, error: "No interaction found in payload" };
        }

        const question = interaction.task?.question_markdown || "";
        const options = interaction.task?.options || [];
        const answer = interaction.task?.answer_key || "";

        console.log('[Audit] Extracted data:', { question, options, answer });

        // 使用分离的 Prompt
        const userPrompt = getAuditUserPrompt({
            targetWord,
            contextMode,
            question,
            options,
            answer
        });

        console.log('[Audit] Calling AIService (smart mode)');
        const { object: result, provider } = await AIService.generateObject({
            mode: 'smart',
            schema: AuditResultSchema,
            system: AUDIT_SYSTEM_PROMPT,
            prompt: userPrompt
        });

        console.log('[Audit] AIService response received from:', provider);
        console.log('[Audit] Result:', result);

        // 保存审计结果
        await createAuditRecord({
            targetWord: targetWord,
            contextMode: contextMode,
            payload: payload,
            status: 'AUDIT',
            auditScore: result.score,
            auditReason: result.reason,
            isRedundant: result.redundancy_detected
        });

        console.log('[Audit] Success! Returning result');
        return { success: true, data: result };

    } catch (error) {
        console.error("[Audit] Failed:", error);
        return { success: false, error: String(error) };
    }
}
