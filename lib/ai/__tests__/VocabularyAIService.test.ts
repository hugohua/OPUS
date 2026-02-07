import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VocabularyAIService } from '../VocabularyAIService';
import { AIService } from '../core';

// Mocks
vi.mock('../core', () => ({
    AIService: {
        generateObject: vi.fn(),
    }
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

    it('should enrich vocabulary using AIService', async () => {
        const mockResult = {
            items: [{
                word: 'negotiate',
                definition_cn: '谈判',
                scenarios: ['negotiation']
            }]
        };

        (AIService.generateObject as any).mockResolvedValue({
            object: mockResult,
            provider: 'mock-provider'
        });

        const result = await service.enrichVocabulary([{ word: 'negotiate', def_en: 'negotiate' }]);

        expect(result.items[0].word).toBe('negotiate');
        expect(AIService.generateObject).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'smart',
            temperature: 0.1,
        }));
    });

    it('should throw and log error on failure', async () => {
        (AIService.generateObject as any).mockRejectedValue(new Error('AI Failed'));

        await expect(service.enrichVocabulary([{ word: 'fail', def_en: 'fail' }])).rejects.toThrow('AI Failed');
    });
});
