/**
 * Fallback Briefing 模板
 * 功能：LLM 超时或报错时返回的硬编码 Level 0 卡片
 * 
 * 使用方法：当 LLM 调用失败时，返回此模板作为兜底
 */

import type { BriefingPayload } from "@/lib/validations/briefing";

/**
 * 硬编码的 Level 0 兜底卡片
 * 示例：System saved data.
 */
export const FALLBACK_BRIEFING: BriefingPayload = {
    meta: {
        format: "chat",
        sender: "System",
        level: 0,
    },
    segments: [
        {
            type: "text",
            content_markdown: "<s>System</s> <v>saved</v> <o>data</o>.",
            audio_text: "System saved data.",
            translation_cn: "系统保存了数据。",
        },
        {
            type: "interaction",
            dimension: "V",
            task: {
                style: "swipe_card",
                question_markdown: "System _______ data.",
                options: ["save", "saved"],
                answer_key: "saved",
                explanation_markdown: "Past tense required. 需要过去时态。",
            },
        },
    ],
};

/**
 * 休息卡片 (Daily Cap 达到时返回)
 */
export const REST_CARD_BRIEFING: BriefingPayload = {
    meta: {
        format: "chat",
        sender: "System",
        level: 0,
    },
    segments: [
        {
            type: "text",
            content_markdown: "You survived today. See you tomorrow.",
            audio_text: "You survived today. See you tomorrow.",
            translation_cn: "今日已存活，明日再战。",
        },
    ],
};
