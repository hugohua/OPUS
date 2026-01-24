/**
 * Briefing 验证模块
 * 功能：
 *   定义 Briefing 相关的 Zod Schema 验证规则
 *   包含 Session 模式、输入验证、评分结果等
 */
import { z } from 'zod';

export const SessionModeSchema = z.enum(['SYNTAX', 'CHUNKING', 'NUANCE']);

export type SessionMode = z.infer<typeof SessionModeSchema>;

export const GetBriefingSchema = z.object({
    userId: z.string().cuid(),
    mode: SessionModeSchema.default('SYNTAX'),
    limit: z.number().int().min(1).max(50).default(10),
    excludeVocabIds: z.array(z.number().int()).default([]),
    forceRefresh: z.boolean().optional().default(false),
});

// FSRS 评分: 1=Again(重来), 2=Hard(困难), 3=Good(良好), 4=Easy(简单)
export const RatingSchema = z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4)
]);

export const RecordOutcomeSchema = z.object({
    userId: z.string().cuid(),
    vocabId: z.number().int().positive(),
    grade: RatingSchema,
    mode: SessionModeSchema,
});

export type GetBriefingInput = z.input<typeof GetBriefingSchema>;
export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;

// --- Briefing Content Schemas ---

export const DrillSegmentSchema = z.object({
    type: z.enum(['text', 'interaction']),
    content_markdown: z.string().optional(),
    audio_text: z.string().optional(),
    dimension: z.string().optional(),
    task: z.object({
        style: z.enum(['swipe_card', 'bubble_select']),
        question_markdown: z.string(),
        options: z.array(z.string()),
        answer_key: z.string(),
        explanation_markdown: z.string().optional(),
    }).optional(),
});

export const BriefingPayloadSchema = z.object({
    meta: z.object({
        format: z.enum(['chat', 'email', 'memo']),
        mode: SessionModeSchema,
        batch_size: z.number().optional(),
        sys_prompt_version: z.string().optional(),
        vocabId: z.number().optional(),
        target_word: z.string().optional(),
        sender: z.string().optional(),
        level: z.number().optional(),
    }),
    segments: z.array(DrillSegmentSchema),
});

export type BriefingPayload = z.infer<typeof BriefingPayloadSchema>;
