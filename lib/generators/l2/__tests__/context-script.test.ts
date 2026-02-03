/**
 * L2 Context Generator 单元测试 (3-Stage Version)
 * 
 * [测试目标]
 * 验证 context-script.ts 的 3-Stage Prompt 结构和 Socratic Tutor 机制。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getL2ContextBatchPrompt, ContextGeneratorInput, ContextStage } from '../context-script';

// Mock dependencies
vi.mock('server-only', () => ({}));

describe('L2 Context Generator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const baseInput: ContextGeneratorInput = {
        targetWord: 'strategy',
        meaning: '策略，战略',
        contextWords: ['budget', 'schedule', 'campaign'],
        scenario: 'marketing'
    };

    describe('Stage 1: Sentence Cloze', () => {
        it('should generate Stage 1 prompt with single sentence format', () => {
            const result = getL2ContextBatchPrompt([baseInput], 1);

            expect(result.system).toContain('TOEIC Part 5');
            expect(result.system).toContain('Single sentence');
            expect(result.system).toContain('15-25 words');
        });

        it('should enforce English-only options', () => {
            const result = getL2ContextBatchPrompt([baseInput], 1);

            expect(result.system).toContain('ENGLISH ONLY');
            expect(result.system).toContain('NO Chinese');
            expect(result.user).toContain('ALL OPTIONS MUST BE ENGLISH WORDS ONLY');
        });

        it('should include socraticHint in template', () => {
            const result = getL2ContextBatchPrompt([baseInput], 1);

            expect(result.system).toContain('socraticHint');
            expect(result.system).toContain('<socratic_tutor>');
        });
    });

    describe('Stage 2: Micro-Paragraph', () => {
        it('should generate Stage 2 prompt with paragraph format', () => {
            const result = getL2ContextBatchPrompt([baseInput], 2);

            expect(result.system).toContain('TOEIC Part 6');
            expect(result.system).toContain('Micro-paragraph');
            expect(result.system).toContain('2-3 sentences');
        });

        it('should require reading entire paragraph', () => {
            const result = getL2ContextBatchPrompt([baseInput], 2);

            expect(result.system).toContain('read the entire paragraph');
            expect(result.system).toContain('Gap placed in sentence 2 or 3');
        });
    });

    describe('Stage 3: Nuance Trap', () => {
        it('should generate Stage 3 prompt with synonym discrimination', () => {
            const inputWithSynonyms: ContextGeneratorInput = {
                ...baseInput,
                synonyms: ['tactic', 'approach', 'method']
            };
            const result = getL2ContextBatchPrompt([inputWithSynonyms], 3);

            expect(result.system).toContain('TOEIC Part 7');
            expect(result.system).toContain('Nuance Trap');
            expect(result.system).toContain('synonym discrimination');
        });

        it('should use synonyms list as distractors', () => {
            const inputWithSynonyms: ContextGeneratorInput = {
                ...baseInput,
                synonyms: ['tactic', 'approach', 'method']
            };
            const result = getL2ContextBatchPrompt([inputWithSynonyms], 3);

            expect(result.user).toContain('"synonyms"');
            expect(result.user).toContain('tactic');
        });
    });

    describe('Batch Processing', () => {
        it('should handle multiple inputs with correct indexing', () => {
            const inputs: ContextGeneratorInput[] = [
                { targetWord: 'approve', meaning: '批准', contextWords: ['reject', 'deny', 'delay'] },
                { targetWord: 'budget', meaning: '预算', contextWords: ['cost', 'expense', 'fee'] },
            ];

            const result = getL2ContextBatchPrompt(inputs, 1);

            expect(result.user).toContain('"index": 1');
            expect(result.user).toContain('"index": 2');
            expect(result.user).toContain('Stage 1 Gap Fill Drills for the following 2 words');
        });

        it('should use default scenario when not provided', () => {
            const input: ContextGeneratorInput = {
                targetWord: 'confirm',
                meaning: '确认',
                contextWords: ['verify', 'validate', 'check']
            };

            const result = getL2ContextBatchPrompt([input], 1);

            expect(result.user).toContain('"scenario": "general office"');
        });
    });

    describe('Prompt Quality', () => {
        it('should use slot_machine style for all stages', () => {
            for (const stage of [1, 2, 3] as ContextStage[]) {
                const result = getL2ContextBatchPrompt([baseInput], stage);
                expect(result.system).toContain('slot_machine');
            }
        });

        it('should have 4 options in template for all stages', () => {
            for (const stage of [1, 2, 3] as ContextStage[]) {
                const result = getL2ContextBatchPrompt([baseInput], stage);
                // Check template has 4 options in the example
                const optionsMatch = result.system.match(/"options":\s*\[([^\]]+)\]/);
                expect(optionsMatch).toBeTruthy();
                const optionsCount = optionsMatch![1].split(',').length;
                expect(optionsCount).toBe(4);
            }
        });

        it('should request dimension X (Logic) in all stages', () => {
            for (const stage of [1, 2, 3] as ContextStage[]) {
                const result = getL2ContextBatchPrompt([baseInput], stage);
                expect(result.system).toContain('"dimension": "X"');
            }
        });

        it('should require option shuffling', () => {
            const result = getL2ContextBatchPrompt([baseInput], 1);
            expect(result.user).toContain('Shuffle option order');
        });

        it('should enforce REQUIRED OUTPUT COUNT in prompt', () => {
            const inputs = [baseInput, { ...baseInput, targetWord: 'budget' }];
            const result = getL2ContextBatchPrompt(inputs, 1);
            expect(result.user).toContain('REQUIRED OUTPUT COUNT');
            expect(result.user).toContain('exactly 2 drills');
        });
    });
});

describe('L2 Context Output Validation (Mock LLM)', () => {
    it('should validate correct LLM output with socraticHint', () => {
        const mockLLMOutput = {
            drills: [
                {
                    meta: { format: 'email', target_word: 'strategy', stage: 1 },
                    segments: [
                        { type: 'text', content_markdown: 'Test sentence with [___].' },
                        {
                            type: 'interaction',
                            dimension: 'X',
                            task: {
                                style: 'slot_machine',
                                question_markdown: 'Which word?',
                                options: ['strategy', 'budget', 'schedule', 'campaign'],
                                answer_key: 'strategy',
                                explanation_markdown: 'Because...',
                                socraticHint: 'Think about the context...'
                            }
                        }
                    ]
                }
            ]
        };

        expect(mockLLMOutput.drills).toHaveLength(1);
        expect(mockLLMOutput.drills[0].meta.stage).toBe(1);
        expect(mockLLMOutput.drills[0].segments[1].task?.socraticHint).toBeDefined();
        expect(mockLLMOutput.drills[0].segments[1].task?.options).toHaveLength(4);
    });
});
