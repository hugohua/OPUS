import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDailyArticleAction } from '../article';
import { prisma } from '@/lib/prisma';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock Dependencies
vi.mock('@/lib/prisma', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    return {
        prisma: mockDeep()
    };
});

vi.mock('server-only', () => ({}));

// Mock Services
const mockGetWordSelection = vi.fn();
vi.mock('@/lib/services/WordSelectionService', () => {
    return {
        WordSelectionService: vi.fn().mockImplementation(() => ({
            getWordSelection: mockGetWordSelection
        }))
    };
});

const mockGenerateArticle = vi.fn();
vi.mock('@/lib/ai/ArticleAIService', () => {
    return {
        ArticleAIService: vi.fn().mockImplementation(() => ({
            generateArticle: mockGenerateArticle
        }))
    };
});

// Mock revalidatePath
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const mockPrisma = prisma as unknown as ReturnType<typeof mockDeep>;

describe('generateDailyArticleAction', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
    });

    it('should return error if no target word found', async () => {
        mockGetWordSelection.mockResolvedValue(null);

        const result = await generateDailyArticleAction({ userId: 'test-user' });

        expect(result.status).toBe('error');
        expect(result.message).toContain('今日无新词可学');
    });

    it('should successfully generate article and save to DB', async () => {
        // Setup Mocks
        const mockTarget = { id: 1, word: 'target', definition_cn: 'def', scenarios: ['management'] };
        const mockContext = { id: 2, word: 'context', definition_cn: 'def', scenarios: ['management'] };

        mockGetWordSelection.mockResolvedValue({
            targetWord: mockTarget,
            contextWords: [mockContext],
            scenario: 'management'
        });

        const mockArticle = {
            title: 'Test Title',
            body: [{ paragraph: 'Content', highlights: ['target'] }],
            summaryZh: 'Summary'
        };
        mockGenerateArticle.mockResolvedValue(mockArticle);

        // Prisma Transaction Mock
        mockPrisma.$transaction.mockImplementation(async (callback) => {
            return callback(mockPrisma);
        });

        mockPrisma.user.findUnique.mockResolvedValue({ id: 'test-user' } as any);
        mockPrisma.article.create.mockResolvedValue({ id: 'article-123', ...mockArticle } as any);

        // Execute
        const result = await generateDailyArticleAction({ userId: 'test-user' });

        // Assert
        expect(result.status).toBe('success');
        expect(result.data?.id).toBe('article-123');
        expect(mockPrisma.articleVocab.create).toHaveBeenCalledTimes(2); // 1 Target + 1 Context
    });

    it('should handle AI service errors', async () => {
        mockGetWordSelection.mockResolvedValue({
            targetWord: { id: 1, word: 'target', scenarios: ['management'] } as any,
            contextWords: [],
            scenario: 'management'
        });

        mockGenerateArticle.mockRejectedValue(new Error('AI Error'));

        const result = await generateDailyArticleAction({ userId: 'test-user' });

        expect(result.status).toBe('error');
        expect(result.message).toContain('AI Error');
    });
});
