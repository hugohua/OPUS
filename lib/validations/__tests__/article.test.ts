import { describe, it, expect } from 'vitest';
import {
    ArticleGenerationInputSchema,
    GeneratedArticleSchema
} from '../article';

describe('Article Validation Schemas', () => {
    describe('ArticleGenerationInputSchema', () => {
        const validVocab = {
            id: 1,
            word: 'test',
            definition_cn: '测试',
            scenarios: ['management']
        };

        it('should accept valid input', () => {
            const result = ArticleGenerationInputSchema.safeParse({
                targetWord: validVocab,
                contextWords: [validVocab, validVocab, validVocab], // 3 context words
                scenario: 'management'
            });
            expect(result.success).toBe(true);
        });

        it('should reject when contextWords is too short', () => {
            const result = ArticleGenerationInputSchema.safeParse({
                targetWord: validVocab,
                contextWords: [], // Empty
                scenario: 'management'
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid scenarios', () => {
            const result = ArticleGenerationInputSchema.safeParse({
                targetWord: validVocab,
                contextWords: [validVocab],
                scenario: 'invalid_scenario'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('GeneratedArticleSchema', () => {
        it('should validate correct AI output structure', () => {
            const validOutput = {
                title: 'Test Article',
                body: [
                    { paragraph: 'P1', highlights: ['word1'] },
                    { paragraph: 'P2', highlights: ['word2'] }
                ],
                summaryZh: 'Summary'
            };
            const result = GeneratedArticleSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });

        it('should reject missing fields', () => {
            const invalidOutput = {
                title: 'Test Article',
                // body missing
                summaryZh: 'Summary'
            };
            const result = GeneratedArticleSchema.safeParse(invalidOutput);
            expect(result.success).toBe(false);
        });
    });
});
