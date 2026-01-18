import { z } from 'zod';
import { ScenariosEnum } from './ai';

/**
 * 词汇摘要 (用于选词结果传递)
 */
export const VocabSummarySchema = z.object({
    id: z.number(),
    word: z.string(),
    definition_cn: z.string().nullable(),
    scenarios: z.array(z.string()),
});

/**
 * 文章生成输入 (选词结果)
 */
export const ArticleGenerationInputSchema = z.object({
    targetWord: VocabSummarySchema,
    contextWords: z.array(VocabSummarySchema).min(1).max(5),
    scenario: ScenariosEnum,
});

/**
 * 文章段落结构 (AI 输出)
 */
export const ArticleParagraphSchema = z.object({
    paragraph: z.string(),
    highlights: z.array(z.string()),
});

/**
 * AI 生成的文章结构
 */
export const GeneratedArticleSchema = z.object({
    title: z.string(),
    body: z.array(ArticleParagraphSchema),
    summaryZh: z.string(),
});

/**
 * 文章生成 Action 输入参数
 */
export const GenerateArticleInputSchema = z.object({
    userId: z.string().optional(), // 可选，默认使用测试用户
});
