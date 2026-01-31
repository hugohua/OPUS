/**
 * L0 规则断言测试 (Phase 2: Business Rules Layer)
 * 
 * 目标：验证 LLM 输出符合 SYSTEM_PROMPT 中定义的业务硬性约束
 * 
 * 区别于 Phase 1 (Schema 测试):
 * - Phase 1 = JSON 结构正确性
 * - Phase 2 = 业务规则正确性 (句子单句、答案正确、干扰项质量等)
 */

import { describe, it, expect } from 'vitest';
import type { BriefingPayload } from '@/types/briefing';

// ============================================
// Mock 数据工厂
// ============================================

/**
 * 创建模拟的 SYNTAX Payload
 * 注意：此处使用 Mock 数据，不调用真实 LLM
 */
function createMockSyntaxPayload(targetWord: string): BriefingPayload {
    return {
        meta: {
            format: 'chat',
            mode: 'SYNTAX',
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 123,
            target_word: targetWord,
            source: 'llm_v2',
        },
        segments: [
            {
                type: 'text',
                content_markdown: `The company decided to **${targetWord}** the project.`,
                translation_cn: '公司决定放弃这个项目。',
            },
            {
                type: 'interaction',
                dimension: 'V',
                task: {
                    style: 'swipe_card',
                    question_markdown: 'The company decided to ________ the project.',
                    options: ['abandon', 'abandons'],
                    answer_key: targetWord,
                    explanation_markdown: '需填动词原形。abandons 是第三人称单数形式。',
                },
            },
        ],
    };
}

/**
 * 创建模拟的 BLITZ Payload
 */
function createMockBlitzPayload(targetWord: string, partner: string): BriefingPayload {
    return {
        meta: {
            format: 'chat',
            mode: 'BLITZ',
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 456,
            target_word: targetWord,
            source: 'llm_v2',
        },
        segments: [
            {
                type: 'text',
                content_markdown: `**${partner}**`,
                translation_cn: '营销策略',
            },
            {
                type: 'interaction',
                dimension: 'V',
                task: {
                    style: 'bubble_select',
                    question_markdown: `________ ${partner}`,
                    options: [
                        { id: 'A', text: targetWord, is_correct: true, type: 'Correct' },
                        { id: 'B', text: 'strategic', is_correct: false, type: 'Visual_Trap' },
                        { id: 'C', text: 'tactics', is_correct: false, type: 'Semantic_Trap' },
                        { id: 'D', text: 'strategies', is_correct: false, type: 'POS_Trap' },
                    ],
                    answer_key: targetWord,
                    explanation: {
                        title: '⚡ Blitz Note',
                        content: `**Formula**: \`${targetWord}\` + \`${partner}\`\n**Why**: 此搭配意为"营销策略"。`,
                        trap_analysis: [
                            '**B**: 词性错误。strategic 是形容词。',
                            '**C**: 搭配不当。tactics 意为"战术"。',
                            '**D**: 词形错误。strategies 是复数形式。',
                        ],
                    },
                },
            },
        ],
    };
}

/**
 * 创建模拟的 PHRASE Payload
 */
function createMockPhrasePayload(targetWord: string, modifier: string): BriefingPayload {
    return {
        meta: {
            format: 'chat',
            mode: 'PHRASE',
            batch_size: 1,
            sys_prompt_version: 'v2.8',
            vocabId: 789,
            target_word: targetWord,
            source: 'llm_v2',
            nuance_goal: 'Describe quality',
        },
        segments: [
            {
                type: 'text',
                content_markdown: `#### ${targetWord}`,
                translation_cn: '策略',
            },
            {
                type: 'interaction',
                dimension: 'C',
                task: {
                    style: 'bubble_select',
                    question_markdown: `________ ${targetWord}`,
                    options: [
                        { id: 'A', text: modifier, is_correct: true, type: 'Correct' },
                        { id: 'B', text: 'strategic', is_correct: false, type: 'POS_Trap' },
                        { id: 'C', text: 'strategically', is_correct: false, type: 'POS_Trap' },
                        { id: 'D', text: 'unplanned', is_correct: false, type: 'Semantic_Trap' },
                    ],
                    answer_key: modifier,
                    explanation: {
                        title: '📝 Phrase Note',
                        content: `**Formula**: \`形容词\` + \`名词\`\n**Why**: "${modifier} ${targetWord}" 符合商务惯用表达。`,
                        trap_analysis: [
                            '**B**: 词性错误。',
                            '**C**: 词性错误。',
                            '**D**: 语意不符。',
                        ],
                    },
                },
            },
        ],
    };
}

// ============================================
// 测试套件
// ============================================

describe('L0 规则断言 (Business Rules)', () => {
    // --------------------------------------------------
    // SYNTAX 场景规则
    // --------------------------------------------------
    describe('SYNTAX 场景', () => {
        it('✅ 规则 1: 句子必须是单句 (无逗号/分号/从句)', () => {
            const payload = createMockSyntaxPayload('abandon');
            const textSegment = payload.segments.find(s => s.type === 'text');

            expect(textSegment).toBeDefined();
            const sentence = textSegment!.content_markdown;

            // 不允许逗号、分号、冒号 (表示复杂句)
            expect(sentence).not.toMatch(/[,;:]/);

            // 不允许连接词 (but, because, although, etc.)
            const bannedWords = /\b(but|because|although|however|therefore|moreover)\b/i;
            expect(sentence).not.toMatch(bannedWords);
        });

        it('✅ 规则 2: 必须包含完整中文翻译', () => {
            const payload = createMockSyntaxPayload('abandon');
            const textSegment = payload.segments.find(s => s.type === 'text');

            expect(textSegment).toBeDefined();
            expect(textSegment!.translation_cn).toBeDefined();
            expect(textSegment!.translation_cn!.length).toBeGreaterThan(0);
        });

        it('✅ 规则 3: Question Stem 必须挖空目标词', () => {
            const payload = createMockSyntaxPayload('abandon');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const question = interaction!.task!.question_markdown!;

            // 必须包含空格符号 (表示挖空)
            expect(question).toMatch(/_{3,}/);

            // 挖空位置不应包含目标词本身 (防止答案泄露)
            expect(question.toLowerCase()).not.toContain(payload.meta.target_word!.toLowerCase());
        });

        it('✅ 规则 4: Answer Key 必须是目标词或其变形', () => {
            const payload = createMockSyntaxPayload('abandon');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const answerKey = interaction!.task!.answer_key!;
            const targetWord = payload.meta.target_word!;

            // Answer 应该是目标词本身或词族变形
            // (这里简化为检查是否包含词根)
            expect(answerKey.toLowerCase()).toContain(targetWord.substring(0, 4).toLowerCase());
        });

        it('✅ 规则 5: Dimension 必须是 V (Visual Audit)', () => {
            const payload = createMockSyntaxPayload('abandon');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            expect(interaction!.dimension).toBe('V');
        });
    });

    // --------------------------------------------------
    // BLITZ 场景规则
    // --------------------------------------------------
    describe('BLITZ 场景', () => {
        it('✅ 规则 1: 目标词必须是正确答案 (Option A)', () => {
            const payload = createMockBlitzPayload('strategy', 'marketing');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const answerKey = interaction!.task!.answer_key!;
            const targetWord = payload.meta.target_word!;

            expect(answerKey).toBe(targetWord);
        });

        it('✅ 规则 2: 必须有 4 个选项 (A/B/C/D)', () => {
            const payload = createMockBlitzPayload('strategy', 'marketing');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const options = interaction!.task!.options || [];

            expect(options).toHaveLength(4);
        });

        it('✅ 规则 3: 干扰项数量必须为 3 (非正确答案)', () => {
            const payload = createMockBlitzPayload('strategy', 'marketing');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const options = interaction!.task!.options || [];
            const distractors = options.filter((o: any) => !o.is_correct);

            expect(distractors).toHaveLength(3);
        });

        it('✅ 规则 4: Partner 词必须在 Question Stem 中可见', () => {
            const partner = 'marketing';
            const payload = createMockBlitzPayload('strategy', partner);
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const question = interaction!.task!.question_markdown!;

            // Partner 词必须出现在 question 中
            expect(question.toLowerCase()).toContain(partner.toLowerCase());
        });

        it('✅ 规则 5: Target 词必须被挖空 (不可见)', () => {
            const targetWord = 'strategy';
            const payload = createMockBlitzPayload(targetWord, 'marketing');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const question = interaction!.task!.question_markdown!;

            // Target 词不应出现在 question 中 (已被空格替代)
            expect(question.toLowerCase()).not.toContain(targetWord.toLowerCase());

            // 必须包含空格符号
            expect(question).toMatch(/_{3,}/);
        });

        it('✅ 规则 6: 所有选项必须唯一 (无重复)', () => {
            const payload = createMockBlitzPayload('strategy', 'marketing');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const options = interaction!.task!.options || [];
            const optionTexts = options.map((o: any) => o.text);
            const uniqueTexts = new Set(optionTexts);

            expect(uniqueTexts.size).toBe(optionTexts.length);
        });
    });

    // --------------------------------------------------
    // PHRASE 场景规则
    // --------------------------------------------------
    describe('PHRASE 场景', () => {
        it('✅ 规则 1: Target Word 必须在 Question Stem 中可见', () => {
            const targetWord = 'strategy';
            const payload = createMockPhrasePayload(targetWord, 'effective');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const question = interaction!.task!.question_markdown!;

            // Target Word 必须出现在 question 中
            expect(question.toLowerCase()).toContain(targetWord.toLowerCase());
        });

        it('✅ 规则 2: Modifier 必须被挖空', () => {
            const payload = createMockPhrasePayload('strategy', 'effective');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const question = interaction!.task!.question_markdown!;

            // 必须包含空格符号 (挖空的 Modifier)
            expect(question).toMatch(/_{3,}/);
        });

        it('✅ 规则 3: Answer Key 必须是 Modifier (非 Target)', () => {
            const targetWord = 'strategy';
            const modifier = 'effective';
            const payload = createMockPhrasePayload(targetWord, modifier);
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const answerKey = interaction!.task!.answer_key!;

            // Answer 应该是 Modifier，不是 Target
            expect(answerKey).toBe(modifier);
            expect(answerKey).not.toBe(targetWord);
        });

        it('✅ 规则 4: Dimension 必须是 C (Drafting)', () => {
            const payload = createMockPhrasePayload('strategy', 'effective');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            expect(interaction!.dimension).toBe('C');
        });

        it('✅ 规则 5: 必须有 4 个选项', () => {
            const payload = createMockPhrasePayload('strategy', 'effective');
            const interaction = payload.segments.find(s => s.type === 'interaction');

            expect(interaction).toBeDefined();
            const options = interaction!.task!.options || [];

            expect(options).toHaveLength(4);
        });

        it('✅ 规则 6: nuance_goal 必须在 meta 中定义', () => {
            const payload = createMockPhrasePayload('strategy', 'effective');

            expect(payload.meta.nuance_goal).toBeDefined();
            expect(typeof payload.meta.nuance_goal).toBe('string');
            expect(payload.meta.nuance_goal!.length).toBeGreaterThan(0);
        });
    });

    // --------------------------------------------------
    // 通用规则 (适用于所有 L0 场景)
    // --------------------------------------------------
    describe('通用规则 (All L0 Modes)', () => {
        const testCases = [
            { mode: 'SYNTAX', payload: () => createMockSyntaxPayload('abandon') },
            { mode: 'BLITZ', payload: () => createMockBlitzPayload('strategy', 'marketing') },
            { mode: 'PHRASE', payload: () => createMockPhrasePayload('strategy', 'effective') },
        ];

        testCases.forEach(({ mode, payload }) => {
            describe(`${mode} 通用规则`, () => {
                it('✅ 必须包含 text segment (内容展示)', () => {
                    const drill = payload();
                    const textSegment = drill.segments.find(s => s.type === 'text');

                    expect(textSegment).toBeDefined();
                    expect(textSegment!.content_markdown).toBeDefined();
                });

                it('✅ 必须包含 interaction segment (交互任务)', () => {
                    const drill = payload();
                    const interaction = drill.segments.find(s => s.type === 'interaction');

                    expect(interaction).toBeDefined();
                    expect(interaction!.task).toBeDefined();
                });

                it('✅ Meta 字段必须完整', () => {
                    const drill = payload();

                    expect(drill.meta.mode).toBe(mode);
                    expect(drill.meta.target_word).toBeDefined();
                    expect(drill.meta.vocabId).toBeGreaterThan(0);
                });

                it('✅ Explanation 必须是简体中文', () => {
                    const drill = payload();
                    const interaction = drill.segments.find(s => s.type === 'interaction');

                    expect(interaction).toBeDefined();

                    const explanation = (interaction!.task as any)?.explanation_markdown
                        || (interaction!.task as any)?.explanation?.content;

                    if (explanation) {
                        // 检查是否包含中文字符
                        const hasChinese = /[\u4e00-\u9fa5]/.test(explanation);
                        expect(hasChinese).toBe(true);
                    }
                });
            });
        });
    });
});
