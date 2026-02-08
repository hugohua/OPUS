/**
 * Briefing 验证模块
 * 功能：
 *   定义 Briefing 相关的 Zod Schema 验证规则
 *   包含 Session 模式、输入验证、评分结果等
 */
import { z } from 'zod';

// 单一场景模式
export const SingleScenarioModeSchema = z.enum([
    'SYNTAX', 'PHRASE', 'BLITZ',     // L0 基础层
    'AUDIO', 'CHUNKING',              // L1 感知层
    'CONTEXT', 'NUANCE',              // L2 应用层
    'READING', 'VISUAL'               // 其他模式
]);

// 混合场景模式
export const MixedScenarioModeSchema = z.enum([
    'L0_MIXED',      // 混合 SYNTAX, PHRASE, BLITZ
    'L1_MIXED',      // 混合 AUDIO, CHUNKING
    'L2_MIXED',      // 混合 CONTEXT, NUANCE
    'DAILY_BLITZ'    // 全场景混合
]);

// SessionMode 统一 Schema（向后兼容）
// 🔧 修复B3: 添加自定义错误消息
export const SessionModeSchema = z.union([
    SingleScenarioModeSchema,
    MixedScenarioModeSchema
], {
    message: 'Invalid session mode. Must be a valid single scenario (SYNTAX, PHRASE, etc.) or mixed mode (L0_MIXED, L1_MIXED, L2_MIXED, DAILY_BLITZ)'
});

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
    track: z.enum(['VISUAL', 'AUDIO', 'CONTEXT']).optional(), // [NEW] Explicit track for cross-track reviews
    duration: z.number().int().nonnegative().optional(), // 毫秒 (ms)
    isRetry: z.boolean().optional(), // 是否为会话内重试
});

export type GetBriefingInput = z.input<typeof GetBriefingSchema>;
export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;

// --- Briefing Content Schemas ---

// 选项 Schema: 支持字符串或对象
const OptionItemSchema = z.object({
    id: z.string().optional(),
    text: z.string(),
    is_correct: z.boolean().optional(),
    type: z.string().optional()
});

// 解析 Schema: 支持对象结构
const ExplanationSchema = z.object({
    title: z.string().optional(),
    content: z.string().optional(), // 用于 Blitz 等
    correct_logic: z.string().optional(), // 用于 Phrase 等
    trap_analysis: z.array(z.string()).optional()
});

export const DrillSegmentSchema = z.object({
    type: z.enum(['text', 'interaction']),
    content_markdown: z.string().optional(),
    audio_text: z.string().optional(),
    emotion: z.string().optional(), // [L1] TTS Emotion Tag (e.g. "urgent", "cheerful")
    translation_cn: z.string().optional(),
    dimension: z.string().optional(),
    task: z.object({
        style: z.enum(['swipe_card', 'bubble_select']),
        question_markdown: z.string(),

        // Options: 支持 string[] 或 object[]
        options: z.union([
            z.array(z.string()),
            z.array(OptionItemSchema)
        ]),

        answer_key: z.string(),

        // Explanation: 支持 markdown 字符串 (legacy) 或 结构化对象 (v2)
        explanation_markdown: z.string().optional(),
        explanation: ExplanationSchema.optional(),
    }).optional(),
});

export const BriefingPayloadSchema = z.object({
    meta: z.object({
        format: z.string().optional(), // 暂未使用，放宽校验以兼容不同 LLM
        mode: SessionModeSchema,
        batch_size: z.number().optional(),
        sys_prompt_version: z.string().optional(),
        vocabId: z.number().optional(),
        target_word: z.string().optional(),
        sender: z.string().optional(),
        level: z.number().optional(),
        isRetry: z.boolean().optional(), // 前端扩展状态：重试标记
        nuance_goal: z.string().optional(), // PHRASE 模式的语义目标
    }),
    segments: z.array(DrillSegmentSchema),
});

export type BriefingPayload = z.infer<typeof BriefingPayloadSchema>;
