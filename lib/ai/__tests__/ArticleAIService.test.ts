// Mock server-only
vi.mock('server-only', () => ({}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArticleAIService } from '../ArticleAIService';
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

describe('ArticleAIService', () => {
    let service: ArticleAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ArticleAIService();
    });

    it('should generate article with correct input', async () => {
        const mockArticle = {
            title: 'Test Article',
            body: [
                { paragraph: 'This is a test.', highlights: [] }
            ],
            summaryZh: 'Test Summary'
        };

        (AIService.generateObject as any).mockResolvedValue({
            object: mockArticle,
            provider: 'mock-provider'
        });

        const input = {
            targetWord: { word: 'negotiate', definition_cn: '谈判' } as any,
            contextWords: [],
            scenario: 'negotiation'
        };

        const result = await service.generateArticle(input as any);

        expect(result.title).toBe('Test Article');
        expect(AIService.generateObject).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'fast',
            system: expect.any(String),
            prompt: expect.stringContaining('negotiate')
        }));
    });

    it('should handle and log AI errors', async () => {
        (AIService.generateObject as any).mockRejectedValue(new Error('Network Error'));

        const input = {
            targetWord: { word: 'error', definition_cn: '错误' } as any,
            contextWords: [],
            scenario: 'tech'
        };

        await expect(service.generateArticle(input as any)).rejects.toThrow('Network Error');
    });
});
