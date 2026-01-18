import { z } from 'zod';
import {
    VocabSummarySchema,
    ArticleGenerationInputSchema,
    GeneratedArticleSchema,
    ArticleParagraphSchema,
} from '@/lib/validations/article';

// 词汇摘要类型
export type VocabSummary = z.infer<typeof VocabSummarySchema>;

// 文章生成输入类型
export type ArticleGenerationInput = z.infer<typeof ArticleGenerationInputSchema>;

// 文章段落类型
export type ArticleParagraph = z.infer<typeof ArticleParagraphSchema>;

// AI 生成文章类型
export type GeneratedArticle = z.infer<typeof GeneratedArticleSchema>;
