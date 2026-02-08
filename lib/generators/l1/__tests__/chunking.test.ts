/**
 * L1.5 Chunking Generator Tests
 * 测试语块排序 Prompt 生成与三层解析法
 */

import { describe, it, expect } from 'vitest';
import {
    getL1ChunkingBatchPrompt,
    ChunkingGeneratorInput,
    ChunkingDrillOutput
} from '../chunking';

describe('L1.5 Chunking Generator', () => {

    // 1. Prompt 结构测试
    describe('Prompt Structure', () => {

        it('Should include sentence complexity requirements', () => {
            const input: ChunkingGeneratorInput = {
                targetWord: 'negotiate',
                context: 'Contract renewal'
            };
            const prompt = getL1ChunkingBatchPrompt([input]);

            expect(prompt.system).toContain('15 - 25 words');
            expect(prompt.system).toContain('Subordinate Clause');
            expect(prompt.system).toContain('Relative Clause');
        });

        it('Should include chunking logic rules', () => {
            const input: ChunkingGeneratorInput = {
                targetWord: 'implement'
            };
            const prompt = getL1ChunkingBatchPrompt([input]);

            expect(prompt.system).toContain('Sense Groups');
            expect(prompt.system).toContain('DO NOT split single words');
            expect(prompt.system).toContain('3 to 5 logical chunks');
        });

        it('Should include three-layer analysis requirements', () => {
            const input: ChunkingGeneratorInput = {
                targetWord: 'strategy'
            };
            const prompt = getL1ChunkingBatchPrompt([input]);

            // Layer 1: Skeleton
            expect(prompt.system).toContain('"skeleton"');
            expect(prompt.system).toContain('"subject"');
            expect(prompt.system).toContain('"verb"');
            expect(prompt.system).toContain('"object"');

            // Layer 2: Links
            expect(prompt.system).toContain('"links"');
            expect(prompt.system).toContain('"from_chunk_id"');
            expect(prompt.system).toContain('"to_chunk_id"');
            expect(prompt.system).toContain('"reason"');

            // Layer 3: Business Insight
            expect(prompt.system).toContain('"business_insight"');
        });

        it('Should include distractor chunk option', () => {
            const input: ChunkingGeneratorInput = {
                targetWord: 'negotiate'
            };
            const prompt = getL1ChunkingBatchPrompt([input]);

            expect(prompt.system).toContain('"distractor_chunk"');
            expect(prompt.system).toContain('logically incorrect');
        });

    });

    // 2. User Prompt 测试
    describe('User Prompt Generation', () => {

        it('Should include input data in user prompt', () => {
            const inputs: ChunkingGeneratorInput[] = [
                { targetWord: 'negotiate', context: 'Contract' },
                { targetWord: 'implement', meaning: '实施' }
            ];
            const prompt = getL1ChunkingBatchPrompt(inputs);

            expect(prompt.user).toContain('GENERATE 2 CHUNKING DRILLS');
            expect(prompt.user).toContain('"targetWord": "negotiate"');
            expect(prompt.user).toContain('"targetWord": "implement"');
        });

        it('Should specify analysis requirements', () => {
            const inputs: ChunkingGeneratorInput[] = [
                { targetWord: 'budget' }
            ];
            const prompt = getL1ChunkingBatchPrompt(inputs);

            expect(prompt.user).toContain('skeleton + links + business_insight');
            expect(prompt.user).toContain('Links array length = chunks length - 1');
        });

    });

    // 3. Few-shot 示例验证
    describe('Few-shot Examples', () => {

        it('Should include complete negotiate example', () => {
            const prompt = getL1ChunkingBatchPrompt([{ targetWord: 'test' }]);

            expect(prompt.system).toContain('Although the initial terms were unfavorable');
            expect(prompt.system).toContain('"grammar_point": "Adverbial Clause of Concession (Although)"');
        });

        it('Should include complete strategy example', () => {
            const prompt = getL1ChunkingBatchPrompt([{ targetWord: 'test' }]);

            expect(prompt.system).toContain('The marketing manager,');
            expect(prompt.system).toContain('"grammar_point": "Non-restrictive Relative Clause (who...)"');
        });

    });

    // 4. Output Schema 验证 (模拟 LLM 输出解析)
    describe('Output Schema Validation', () => {

        it('Should validate correct ChunkingDrillOutput structure', () => {
            const mockOutput: ChunkingDrillOutput = {
                target_word: 'negotiate',
                full_sentence: 'Although the initial terms were unfavorable, we successfully negotiated a compromise.',
                translation_cn: '虽然最初的条款不利，但我们成功通过谈判达成了折中方案。',
                grammar_point: 'Adverbial Clause of Concession',
                complexity_level: 'Medium',
                chunks: [
                    { id: 1, text: 'Although the initial terms', type: 'CONJ' },
                    { id: 2, text: 'were unfavorable,', type: 'MOD' },
                    { id: 3, text: 'we successfully negotiated', type: 'S' },
                    { id: 4, text: 'a compromise.', type: 'O' }
                ],
                distractor_chunk: 'because the terms',
                analysis: {
                    skeleton: {
                        subject: 'we',
                        verb: 'negotiated',
                        object: 'a compromise'
                    },
                    links: [
                        { from_chunk_id: 1, to_chunk_id: 2, reason: '连词引导让步从句' },
                        { from_chunk_id: 2, to_chunk_id: 3, reason: '从句结束，主句开始' },
                        { from_chunk_id: 3, to_chunk_id: 4, reason: '及物动词需接宾语' }
                    ],
                    business_insight: '先抑后扬，突出成果'
                }
            };

            // Validate structure
            expect(mockOutput.chunks).toHaveLength(4);
            expect(mockOutput.analysis.links).toHaveLength(3); // chunks.length - 1
            expect(mockOutput.analysis.skeleton.subject).toBe('we');
            expect(mockOutput.complexity_level).toMatch(/^(Medium|High)$/);
        });

        it('Should allow null distractor_chunk', () => {
            const mockOutput: ChunkingDrillOutput = {
                target_word: 'strategy',
                full_sentence: 'The manager proposed a new strategy.',
                translation_cn: '经理提出了新策略。',
                grammar_point: 'Simple SVO',
                complexity_level: 'Medium',
                chunks: [
                    { id: 1, text: 'The manager', type: 'S' },
                    { id: 2, text: 'proposed', type: 'V' },
                    { id: 3, text: 'a new strategy.', type: 'O' }
                ],
                distractor_chunk: null, // No distractor
                analysis: {
                    skeleton: { subject: 'The manager', verb: 'proposed', object: 'a new strategy' },
                    links: [
                        { from_chunk_id: 1, to_chunk_id: 2, reason: '主语接谓语' },
                        { from_chunk_id: 2, to_chunk_id: 3, reason: '及物动词接宾语' }
                    ],
                    business_insight: '简洁陈述'
                }
            };

            expect(mockOutput.distractor_chunk).toBeNull();
        });

    });

});
