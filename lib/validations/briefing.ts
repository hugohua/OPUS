/**
 * Briefing 验证模块
 * 功能：定义 BriefingPayload 的 Zod Schema
 * 
 * 遵循 SYSTEM_PROMPT.md L118-143 规范
 */

import { z } from "zod";

// ============================================
// Text Segment Schema
// ============================================

export const TextSegmentSchema = z.object({
    type: z.literal("text"),
    content_markdown: z.string(),
    audio_text: z.string().optional(),
    translation_cn: z.string().optional(),
});

// ============================================
// Interaction Task Schema
// ============================================

export const InteractionTaskSchema = z.object({
    style: z.enum(["swipe_card", "bubble_select"]),
    question_markdown: z.string(),
    options: z.array(z.string()).min(2),
    answer_key: z.string(),
    /** 解释逻辑 (Refutation + Syntax) */
    explanation_markdown: z.string().optional(),
});

// ============================================
// Interaction Segment Schema
// ============================================

export const InteractionSegmentSchema = z.object({
    type: z.literal("interaction"),
    dimension: z.enum(["V", "C", "M", "X"]),
    task: InteractionTaskSchema,
});

// ============================================
// Full BriefingPayload Schema
// ============================================

export const BriefingMetaSchema = z.object({
    format: z.enum(["chat", "email", "memo"]),
    sender: z.string(),
    level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export const BriefingPayloadSchema = z.object({
    meta: BriefingMetaSchema,
    segments: z.array(z.union([TextSegmentSchema, InteractionSegmentSchema])),
});

// ============================================
// Type Exports
// ============================================

export type TextSegment = z.infer<typeof TextSegmentSchema>;
export type InteractionTask = z.infer<typeof InteractionTaskSchema>;
export type InteractionSegment = z.infer<typeof InteractionSegmentSchema>;
export type BriefingMeta = z.infer<typeof BriefingMetaSchema>;
export type BriefingPayload = z.infer<typeof BriefingPayloadSchema>;
