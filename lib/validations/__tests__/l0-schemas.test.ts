/**
 * L0 Schema 验证测试 (Phase 1: Defense Layer)
 */
import { describe, it, expect } from 'vitest';
import {
    L0SyntaxSchema,
    L0PhraseSchema,
    L0BlitzSchema,
    validateL0Payload,
    createPivotPayload,
    getL0Schema,
} from '../l0-schemas';

// ============================================
// 测试数据工厂
// ============================================

function createValidSyntaxPayload() {
    return {
        meta: {
            format: 'chat' as const,
            mode: 'SYNTAX' as const,
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 123,
            target_word: 'abandon',
            source: 'llm_v2',
        },
        segments: [
            {
                type: 'text' as const,
                content_markdown: 'The company decided to **abandon** the project.',
                translation_cn: '公司决定放弃这个项目。',
            },
            {
                type: 'interaction' as const,
                dimension: 'V',
                task: {
                    style: 'swipe_card' as const,
                    question_markdown: 'Is this sentence grammatically correct?',
                    options: ['Yes', 'No'],
                    answer_key: 'Yes',
                    explanation_markdown: 'The sentence uses S-V-O structure correctly.',
                },
            },
        ],
    };
}

function createValidPhrasePayload() {
    return {
        meta: {
            format: 'chat' as const,
            mode: 'PHRASE' as const,
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 456,
            target_word: 'make',
            source: 'llm_v2',
        },
        segments: [
            {
                type: 'text' as const,
                content_markdown: 'We need to **make** a decision.',
            },
            {
                type: 'interaction' as const,
                dimension: 'C',
                task: {
                    style: 'bubble_select' as const,
                    question_markdown: 'Choose the correct collocation:',
                    options: [
                        { text: 'make a decision', is_correct: true },
                        { text: 'do a decision', is_correct: false },
                    ],
                    answer_key: 'make a decision',
                },
            },
        ],
    };
}

function createValidBlitzPayload() {
    return {
        meta: {
            format: 'chat' as const,
            mode: 'BLITZ' as const,
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 789,
            target_word: 'strategy',
            source: 'llm_v2',
        },
        segments: [
            {
                type: 'text' as const,
                content_markdown: 'The manager developed a new marketing ___.',
            },
            {
                type: 'interaction' as const,
                dimension: 'V',
                task: {
                    style: 'bubble_select' as const,
                    question_markdown: 'Fill in the blank:',
                    options: [
                        { text: 'strategy', is_correct: true },
                        { text: 'strategic', is_correct: false },
                        { text: 'strategize', is_correct: false },
                        { text: 'strategies', is_correct: false },
                    ],
                    answer_key: 'strategy',
                },
            },
        ],
    };
}

// ============================================
// SYNTAX Schema 测试
// ============================================

describe('L0SyntaxSchema', () => {
    it('应通过有效的 SYNTAX Payload', () => {
        const payload = createValidSyntaxPayload();
        const result = L0SyntaxSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it('应拒绝缺少 vocabId 的 Payload', () => {
        const payload = createValidSyntaxPayload();
        // @ts-expect-error 测试删除必需字段
        delete payload.meta.vocabId;

        const result = L0SyntaxSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.message).toContain('vocabId');
        }
    });

    it('应拒绝无 V 维度交互的 Payload', () => {
        const payload = createValidSyntaxPayload();
        payload.segments[1].dimension = 'C'; // 改为 C 维度

        const result = L0SyntaxSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('V (Visual)');
        }
    });
});

// ============================================
// PHRASE Schema 测试
// ============================================

describe('L0PhraseSchema', () => {
    it('应通过有效的 PHRASE Payload', () => {
        const payload = createValidPhrasePayload();
        const result = L0PhraseSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it('应拒绝无 C 维度交互的 Payload', () => {
        const payload = createValidPhrasePayload();
        payload.segments[1].dimension = 'V'; // 改为 V 维度

        const result = L0PhraseSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('C (Context)');
        }
    });

    it('应拒绝非 bubble_select 样式', () => {
        const payload = createValidPhrasePayload();
        payload.segments[1].task!.style = 'swipe_card';

        const result = L0PhraseSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('bubble_select');
        }
    });
});

// ============================================
// BLITZ Schema 测试
// ============================================

describe('L0BlitzSchema', () => {
    it('应通过有效的 BLITZ Payload', () => {
        const payload = createValidBlitzPayload();
        const result = L0BlitzSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it('应拒绝非 4 个选项的 Payload', () => {
        const payload = createValidBlitzPayload();
        payload.segments[1].task!.options = [
            { text: 'strategy', is_correct: true },
            { text: 'strategic', is_correct: false },
        ]; // 只有 2 个选项

        const result = L0BlitzSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('4 个选项');
        }
    });

    it('应拒绝 answer_key 不等于 target_word 的 Payload', () => {
        const payload = createValidBlitzPayload();
        payload.segments[1].task!.answer_key = 'strategic'; // 错误答案

        const result = L0BlitzSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('answer_key 必须等于 target_word');
        }
    });
});

// ============================================
// validateL0Payload 函数测试
// ============================================

describe('validateL0Payload', () => {
    it('应返回验证成功结果', () => {
        const payload = createValidSyntaxPayload();
        const result = validateL0Payload('SYNTAX', payload);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('应返回详细错误信息', () => {
        const invalidPayload = { meta: {}, segments: [] };
        const result = validateL0Payload('SYNTAX', invalidPayload);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.rawPayload).toBe(invalidPayload);
    });
});

// ============================================
// createPivotPayload 函数测试
// ============================================

describe('createPivotPayload', () => {
    it('应生成有效的 SYNTAX Pivot Payload', () => {
        const pivot = createPivotPayload('SYNTAX', 123, 'test');

        expect(pivot.meta.mode).toBe('SYNTAX');
        expect(pivot.meta.vocabId).toBe(123);
        expect(pivot.meta.target_word).toBe('test');
        expect(pivot.meta.source).toBe('pivot_fallback');
        expect(pivot.segments).toHaveLength(2);
    });

    it('应为 PHRASE 模式使用 C 维度', () => {
        const pivot = createPivotPayload('PHRASE', 456, 'make');

        const interaction = pivot.segments.find(s => s.type === 'interaction');
        expect(interaction?.dimension).toBe('C');
    });

    it('应为 BLITZ 模式使用 V 维度、4 选项和 answer_key 自洽', () => {
        const pivot = createPivotPayload('BLITZ', 789, 'strategy');

        const interaction = pivot.segments.find(s => s.type === 'interaction');
        expect(interaction?.dimension).toBe('V');
        expect(interaction?.task?.options).toHaveLength(4);
        expect(interaction?.task?.answer_key).toBe('strategy');
        expect(interaction?.task?.style).toBe('bubble_select');
    });
});

// ============================================
// getL0Schema 函数测试
// ============================================

describe('getL0Schema', () => {
    it('应根据 mode 返回正确的 Schema', () => {
        expect(getL0Schema('SYNTAX')).toBe(L0SyntaxSchema);
        expect(getL0Schema('PHRASE')).toBe(L0PhraseSchema);
        expect(getL0Schema('BLITZ')).toBe(L0BlitzSchema);
    });

    it('应对未知 mode 抛出错误', () => {
        // @ts-expect-error 测试无效 mode
        expect(() => getL0Schema('INVALID')).toThrow('Unknown L0 mode');
    });
});
