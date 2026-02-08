/**
 * L0 场景专属 Schema (Phase 1: Defense Layer)
 * 
 * 设计原则：
 * 1. 继承通用 BriefingPayload 结构
 * 2. 添加场景特定约束 (SYNTAX/PHRASE/BLITZ)
 * 3. 增强错误信息可调试性
 */
import { z } from 'zod';
import { BriefingPayloadSchema } from './briefing';
import { BriefingPayload } from '@/types/briefing';

// ============================================
// L0 共享约束
// ============================================

/**
 * L0 Meta 扩展: 必须包含 vocabId 和 target_word
 */
const L0MetaSchema = z.object({
    format: z.string().optional(), // 暂未使用，放宽校验以兼容不同 LLM
    mode: z.enum(['SYNTAX', 'PHRASE', 'BLITZ']),
    batch_size: z.number().optional(),
    sys_prompt_version: z.string().optional(),
    vocabId: z.number(),
    target_word: z.string().min(1, 'L0 必须包含 target_word'),
    source: z.string().optional(),
});

/**
 * Interaction Segment: 必须包含 task
 */
const L0InteractionSegmentSchema = z.object({
    type: z.literal('interaction'),
    dimension: z.enum(['V', 'C', 'M', 'X', 'A']),
    task: z.object({
        style: z.enum(['swipe_card', 'bubble_select']),
        question_markdown: z.string().min(1, '问题不能为空'),
        options: z.array(z.any()).min(2, '选项至少 2 个'),
        answer_key: z.string().min(1, '答案不能为空'),
        explanation_markdown: z.string().optional(),
        explanation: z.any().optional(),
    }),
});

// ============================================
// SYNTAX Schema
// ============================================

export const L0SyntaxSchema = z.object({
    meta: L0MetaSchema.extend({
        mode: z.literal('SYNTAX'),
    }),
    segments: z.array(z.any()).min(1),
}).refine(
    (data) => {
        // 规则 1: 必须包含 V 维度交互
        const hasVDimension = data.segments.some(
            (s: any) => s.type === 'interaction' && s.dimension === 'V'
        );
        return hasVDimension;
    },
    {
        message: 'SYNTAX 必须包含 V (Visual) 维度交互段',
        path: ['segments'],
    }
).refine(
    (data) => {
        // 规则 2: text segment 必须包含中文翻译
        const textSegment = data.segments.find((s: any) => s.type === 'text');
        if (!textSegment) return true; // 允许无 text segment
        return textSegment.translation_cn?.length > 0;
    },
    {
        message: 'SYNTAX text segment 必须包含 translation_cn',
        path: ['segments', 'translation_cn'],
    }
);

// ============================================
// PHRASE Schema
// ============================================

export const L0PhraseSchema = z.object({
    meta: L0MetaSchema.extend({
        mode: z.literal('PHRASE'),
    }),
    segments: z.array(z.any()).min(1),
}).refine(
    (data) => {
        // 规则 1: 必须包含 C 维度交互
        const hasCDimension = data.segments.some(
            (s: any) => s.type === 'interaction' && s.dimension === 'C'
        );
        return hasCDimension;
    },
    {
        message: 'PHRASE 必须包含 C (Context) 维度交互段',
        path: ['segments'],
    }
).refine(
    (data) => {
        // 规则 2: 选项必须使用 bubble_select
        const interaction = data.segments.find((s: any) => s.type === 'interaction');
        if (!interaction?.task) return true;
        return interaction.task.style === 'bubble_select';
    },
    {
        message: 'PHRASE 必须使用 bubble_select 交互样式',
        path: ['segments', 'task', 'style'],
    }
);

// ============================================
// BLITZ Schema
// ============================================

export const L0BlitzSchema = z.object({
    meta: L0MetaSchema.extend({
        mode: z.literal('BLITZ'),
    }),
    segments: z.array(z.any()).min(1),
}).refine(
    (data) => {
        // 规则 1: 必须包含 V 维度交互
        const hasVDimension = data.segments.some(
            (s: any) => s.type === 'interaction' && s.dimension === 'V'
        );
        return hasVDimension;
    },
    {
        message: 'BLITZ 必须包含 V (Visual) 维度交互段',
        path: ['segments'],
    }
).refine(
    (data) => {
        // 规则 2: 必须有 4 个选项 (1 正确 + 3 干扰)
        const interaction = data.segments.find((s: any) => s.type === 'interaction');
        if (!interaction?.task?.options) return false;
        return interaction.task.options.length === 4;
    },
    {
        message: 'BLITZ 必须恰好有 4 个选项 (1 正确 + 3 干扰)',
        path: ['segments', 'task', 'options'],
    }
).refine(
    (data) => {
        // 规则 3: answer_key 必须是目标词 (增强防护)
        const interaction = data.segments.find((s: any) => s.type === 'interaction');
        // 防护: 两者都必须存在
        if (!interaction?.task?.answer_key || !data.meta.target_word) return false;
        const targetWord = data.meta.target_word.toLowerCase();
        const answerKey = interaction.task.answer_key.toLowerCase();
        return answerKey === targetWord;
    },
    {
        message: 'BLITZ answer_key 必须等于 target_word',
        path: ['segments', 'task', 'answer_key'],
    }
);

// ============================================
// Schema 路由器
// ============================================

export type L0Mode = 'SYNTAX' | 'PHRASE' | 'BLITZ';

/**
 * 根据 mode 返回对应的 L0 Schema
 */
export function getL0Schema(mode: L0Mode) {
    switch (mode) {
        case 'SYNTAX':
            return L0SyntaxSchema;
        case 'PHRASE':
            return L0PhraseSchema;
        case 'BLITZ':
            return L0BlitzSchema;
        default:
            throw new Error(`Unknown L0 mode: ${mode}`);
    }
}

/**
 * 验证 L0 Payload 并返回详细错误
 */
export function validateL0Payload(mode: L0Mode, payload: unknown): {
    success: boolean;
    data?: z.infer<typeof BriefingPayloadSchema>;
    error?: string;
    rawPayload?: unknown;
} {
    const schema = getL0Schema(mode);
    const result = schema.safeParse(payload);

    if (!result.success) {
        // 构建详细错误信息 (含原始 JSON 片段)
        const errorDetails = result.error.issues.map(issue => {
            const path = issue.path.join('.');
            return `[${path}] ${issue.message}`;
        }).join('; ');

        return {
            success: false,
            error: errorDetails,
            rawPayload: payload, // 保留原始数据用于调试
        };
    }

    return {
        success: true,
        data: result.data as any,
    };
}

// ============================================
// Pivot 兜底 Schema (生成失败时使用)
// ============================================

/**
 * 生成安全的兜底 Payload
 * 确保前端不白屏
 */
export function createPivotPayload(
    mode: L0Mode,
    vocabId: number,
    targetWord: string,
    fallbackMessage = '系统繁忙，请稍后重试'
): BriefingPayload {
    return {
        meta: {
            format: 'chat',
            mode: mode,
            batch_size: 1,
            sys_prompt_version: 'pivot-v1',
            vocabId,
            target_word: targetWord,
            source: 'pivot_fallback',
        },
        segments: [
            {
                type: 'text',
                content_markdown: `**${targetWord}**\n\n${fallbackMessage}`,
                translation_cn: '系统正在生成中...',
            },
            {
                type: 'interaction',
                dimension: mode === 'PHRASE' ? 'C' : 'V',
                task: {
                    // BLITZ 模式需要 4 个选项，其他模式 2 个选项
                    style: mode === 'BLITZ' ? 'bubble_select' as const : 'swipe_card' as const,
                    question_markdown: mode === 'BLITZ'
                        ? `Fill in the blank: The ___ is important.`
                        : `Is **${targetWord}** a valid English word?`,
                    options: mode === 'BLITZ'
                        ? [targetWord, `${targetWord}s`, `${targetWord}ed`, `${targetWord}ing`] // 4 个选项
                        : ['Yes', 'No'],
                    answer_key: mode === 'BLITZ' ? targetWord : 'Yes',
                    explanation_markdown: `${targetWord} is the correct form.`,
                },
            },
        ],
    };
}
