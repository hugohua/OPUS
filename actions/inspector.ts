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
import { auth } from '@/auth';

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

/**
 * 模拟内容生成 (Content Simulation)
 * 
 * 功能：
 *   直接调用 OMPS 核心选词逻辑，展示如果当前用户（或目标用户）现在开始学习，
 *   系统会推荐哪些单词。用于调试 OMPS 算法和 FSRS 调度。
 */
export async function simulateContent(
    inputUserId?: string,
    mode: string = 'L0_MIXED',
    limit: number = 20,
    forceRefresh: boolean = false
) {
    try {
        // 1. Security Check
        const session = await auth();
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // 默认使用当前管理员 ID，或者指定的测试用户 ID
        const targetUserId = inputUserId || session.user.id;
        if (!targetUserId) {
            return { success: false, error: "No user ID found" };
        }

        console.log('[Inspector] Simulating content for:', { targetUserId, mode, limit });

        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');

        // 2. Clear Cache if forced
        if (forceRefresh) {
            const { inventory } = await import('@/lib/core/inventory');
            await inventory.clearMode(targetUserId, mode);
            console.log('[Inspector] Cache cleared for:', { targetUserId, mode });
        }

        // 3. Fetch Candidates
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        const candidates = await fetchOMPSCandidates(
            targetUserId,
            safeLimit,
            undefined, // config
            [], // excludeIds
            mode // session mode
        );

        // 4. Transform for Display
        const mappedData = candidates.map((c, index) => ({
            rank: index + 1,
            vocabId: c.vocabId,
            word: c.word,
            definition_cn: c.definition_cn,
            partOfSpeech: c.partOfSpeech || 'unknown',
            frequency_score: c.frequency_score,
            priority_level: c.priority_level, // 2=Review, 3=New
            bucket: c.type, // REVIEW / NEW
            stability: c.reviewData?.stability || 0,
            due: c.reviewData?.next_review_at || null,
            reason: c.type === 'REVIEW'
                ? `复习 (S:${c.reviewData?.stability?.toFixed(1)})`
                : `新词 (F:${c.frequency_score})`
        }));

        // 5. Calculate Stats
        const { db } = await import('@/lib/db');
        const masteredCount = await db.userVocabState.count({
            where: {
                userId: targetUserId,
                status: 'MASTERED'
            }
        });

        const vocabCoverage = Math.min(Math.round((masteredCount / 3000) * 100), 100);
        const targetScore = Math.min(Math.round(200 + (masteredCount * 0.5)), 990);

        return {
            success: true,
            data: mappedData,
            stats: {
                vocabCoverage,
                targetScore
            }
        };

    } catch (error) {
        console.error("[Inspector] Simulation failed:", error);
        return { success: false, error: String(error) };
    }
}
