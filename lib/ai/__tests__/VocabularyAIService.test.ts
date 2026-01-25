import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VocabularyAIService } from '../VocabularyAIService';
import { generateText } from 'ai';

// Mocks
vi.mock('ai', () => ({
    generateText: vi.fn(),
}));

vi.mock('../client', () => ({
    getAIModel: vi.fn(() => ({
        model: { name: 'mock-model' },
        modelName: 'mock-model'
    })),
}));

vi.mock('../utils', () => ({
    safeParse: vi.fn((text, schema) => {
        // Simple mock of safeParse
        return JSON.parse(text);
    }),
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    }),
    logAIError: vi.fn(),
}));

describe('VocabularyAIService', () => {
    let service: VocabularyAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VocabularyAIService();
    });

    it('should enrich vocabulary and sanitize scenarios', async () => {
        const mockRawResponse = JSON.stringify({
            items: [{
                word: 'negotiate',
                definition_cn: '谈判',
                scenarios: ['negotiation', 'invalid_tag'] // invalid_tag should be dropped
            }]
        });

        (generateText as any).mockResolvedValue({ text: mockRawResponse });

        const result = await service.enrichVocabulary([{ word: 'negotiate', def_en: 'negotiate' }]);

        expect(result.items[0].scenarios).toEqual(['negotiation']);
        expect(generateText).toHaveBeenCalled();
    });

    it('should throw and log error on failure', async () => {
        (generateText as any).mockRejectedValue(new Error('AI Failed'));

        await expect(service.enrichVocabulary([{ word: 'fail', def_en: 'fail' }])).rejects.toThrow('AI Failed');
    });
});
