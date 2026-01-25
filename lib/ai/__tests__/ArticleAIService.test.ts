// Mock server-only
vi.mock('server-only', () => ({}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticleAIService } from '../ArticleAIService';
import { generateText } from 'ai';

// Mocks
vi.mock('ai', () => ({
    generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(() => ({
        chat: vi.fn((name) => ({ name }))
    }))
}));

vi.mock('../utils', () => ({
    safeParse: vi.fn((text, schema) => JSON.parse(text)),
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    }),
    logAIError: vi.fn(),
}));

describe('ArticleAIService', () => {
    let service: ArticleAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ArticleAIService('test-model');
    });

    it('should generate article with correct input', async () => {
        const mockArticle = {
            title: 'Test Article',
            content: 'This is a test content with negotiate.',
            target_word: 'negotiate',
            vocabulary_highlights: ['negotiate']
        };

        (generateText as any).mockResolvedValue({ text: JSON.stringify(mockArticle) });

        const input = {
            targetWord: { word: 'negotiate', definition_cn: '谈判' } as any,
            contextWords: [],
            scenario: 'negotiation'
        };

        const result = await service.generateArticle(input as any);

        expect(result.title).toBe('Test Article');
        expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
            system: expect.any(String),
            prompt: expect.stringContaining('negotiate')
        }));
    });

    it('should handle and log AI errors', async () => {
        (generateText as any).mockRejectedValue(new Error('Network Error'));

        const input = {
            targetWord: { word: 'error', definition_cn: '错误' } as any,
            contextWords: [],
            scenario: 'tech'
        };

        await expect(service.generateArticle(input as any)).rejects.toThrow('Network Error');
    });
});
