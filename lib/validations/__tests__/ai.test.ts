import { describe, it, expect } from 'vitest';
import { VocabularyResultItemSchema } from '../ai';

describe('VocabularyResultItemSchema', () => {
    it('should transform priority CORE to is_toeic_core true', () => {
        const input = {
            word: 'test',
            definition_cn: '测试',
            definitions: { business_cn: '测试', general_cn: '测试' },
            priority: 'CORE',
            scenarios: ['management'],
            collocations: [{ text: 'test', trans: '测试', origin: 'ai' }],
            word_family: { n: 'test', v: null, adj: null, adv: null },
            confusing_words: ['a'],
            synonyms: ['b']
        };

        const result = VocabularyResultItemSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.is_toeic_core).toBe(true);
            expect(result.data.priority).toBe('CORE');
            expect(result.data.word_family?.n).toBe('test');
        }
    });

    it('should transform priority SUPPORT to is_toeic_core false', () => {
        const input = {
            word: 'test',
            definition_cn: '测试',
            definitions: { business_cn: '测试', general_cn: '测试' },
            priority: 'SUPPORT',
            scenarios: ['management'],
            collocations: [{ text: 'test', trans: '测试', origin: 'ai' }],
            word_family: null,
            confusing_words: [],
            synonyms: []
        };

        const result = VocabularyResultItemSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.is_toeic_core).toBe(false);
            expect(result.data.priority).toBe('SUPPORT');
        }
    });

    it('should validate max length of definition_cn', () => {
        const input = {
            word: 'test',
            definition_cn: '这是一个非常非常长的中文释义超过了十个字',
            definitions: { business_cn: '测试', general_cn: '测试' },
            priority: 'CORE',
            scenarios: ['management'],
            collocations: [],
            confusing_words: [],
            synonyms: []
        };
        const result = VocabularyResultItemSchema.safeParse(input);
        expect(result.success).toBe(false);
    });
});
