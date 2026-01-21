'use server';

/**
 * Generate Briefing Action
 * 功能：生成 Level 0 Drill Card
 * 
 * 遵循 SYSTEM_PROMPT.md 规范:
 * - Daily Cap: 每日 20 张上限
 * - LLM 超时: 返回 Fallback 模板
 * - 输出格式: BriefingPayload
 */

import { generateText } from 'ai';
import { DRILL_SYSTEM_PROMPT, getDrillUserPrompt, type DrillContext } from '@/lib/prompts/drill';
import { BriefingPayloadSchema, type BriefingPayload } from '@/lib/validations/briefing';
import { FALLBACK_BRIEFING, REST_CARD_BRIEFING } from '@/lib/templates/fallback-briefing';
import { safeParse } from '@/lib/ai/utils';
import { createLogger, logAIError } from '@/lib/logger';
import { getAIModel } from '@/lib/ai/client';
import type { ActionState } from '@/types';

const log = createLogger('briefing');

// ============================================
// Constants
// ============================================

const DAILY_CAP = 20;

// ============================================
// Main Action
// ============================================

interface GenerateBriefingInput {
    /** 目标词汇 */
    targetWord: string;
    /** 核心释义 */
    meaning: string;
    /** 复习词汇列表 (1+N 规则中的 N) */
    contextWords?: string[];
    /** 词族变体 */
    wordFamily?: Record<string, string>;
    /** 今日已完成数量 (由前端传入或后端查询) */
    todayCount?: number;
}

/**
 * 生成 Briefing (Drill Card) Server Action
 * 
 * @param input - 生成所需的输入数据
 * @returns ActionState<BriefingPayload>
 */
export async function generateBriefingAction(
    input: GenerateBriefingInput
): Promise<ActionState<BriefingPayload>> {
    const todayCount = input.todayCount ?? 0;

    // ============================================
    // 1. Daily Cap Check (SYSTEM_PROMPT.md L76)
    // ============================================
    if (todayCount >= DAILY_CAP) {
        log.info({ todayCount }, 'Daily cap reached, returning REST_CARD');
        return {
            status: 'success',
            message: 'Daily cap reached',
            data: REST_CARD_BRIEFING,
        };
    }

    // ============================================
    // 2. Prepare Context
    // ============================================
    const context: DrillContext = {
        targetWord: input.targetWord,
        meaning: input.meaning,
        contextWords: input.contextWords ?? [],
        wordFamily: input.wordFamily ?? { v: input.targetWord },
    };

    const userPrompt = getDrillUserPrompt(context);
    let rawResponse: string | undefined;

    // ============================================
    // 3. Call LLM
    // ============================================
    try {
        const { model, modelName } = getAIModel('default');

        log.info({ targetWord: input.targetWord, model: modelName }, 'Generating Drill Card');

        const { text } = await generateText({
            model,
            system: DRILL_SYSTEM_PROMPT,
            prompt: userPrompt,
            temperature: 0.3,
        });

        rawResponse = text;
        log.debug({ responseLength: text.length }, 'AI response received');

        // ============================================
        // 4. Parse and Validate
        // ============================================
        const briefing = safeParse(text, BriefingPayloadSchema, {
            systemPrompt: DRILL_SYSTEM_PROMPT,
            userPrompt,
            model: modelName,
        });

        return {
            status: 'success',
            message: 'Briefing generated successfully',
            data: briefing,
        };
    } catch (error) {
        // ============================================
        // 5. Fallback (SYSTEM_PROMPT.md L152)
        // ============================================
        logAIError({
            error,
            systemPrompt: DRILL_SYSTEM_PROMPT,
            userPrompt,
            rawResponse,
            model: process.env.AI_MODEL_NAME || 'qwen-plus',
            context: 'generateBriefingAction 调用失败，返回 Fallback',
        });

        log.warn({ error }, 'LLM failed, returning FALLBACK_BRIEFING');

        return {
            status: 'success',
            message: 'Fallback briefing returned due to LLM error',
            data: FALLBACK_BRIEFING,
        };
    }
}
