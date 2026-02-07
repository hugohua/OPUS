import 'server-only';
import { AIService } from './core';
import { GeneratedArticleSchema } from '@/lib/validations/article';
import type { ArticleGenerationInput, GeneratedArticle } from '@/types/article';
import { ARTICLE_GENERATION_PROMPT } from '@/lib/generators/etl/article';
import { createLogger, logAIError } from '@/lib/logger';

const log = createLogger('article-ai');

/**
 * 文章 AI 生成服务
 * 
 * 使用 AI 模型根据选词结果生成商务英语短文
 */
export class ArticleAIService {
    // modelName is now managed by AIService internally based on mode
    // We keep this property for compatibility if needed, or remove it.
    // For logging, we'll just say "AIService" or get it from result.
    constructor() {
    }

    /**
     * 生成文章
     * @param input - 选词结果 (Target + Context + Scenario)
     * @returns 生成的文章结构
     */
    async generateArticle(input: ArticleGenerationInput): Promise<GeneratedArticle> {
        const { targetWord, contextWords, scenario } = input;

        log.info({
            targetWord: targetWord.word,
            contextWords: contextWords.map(w => w.word),
            scenario,
            model: 'AIService',
        }, 'Generating article');

        const userPrompt = JSON.stringify({
            targetWord: {
                word: targetWord.word,
                definition_cn: targetWord.definition_cn,
            },
            contextWords: contextWords.map(w => ({
                word: w.word,
                definition_cn: w.definition_cn,
            })),
            scenario,
        });

        let rawResponse: string | undefined;

        try {
            const { object: article, provider } = await AIService.generateObject({
                mode: 'fast', // Article generation is time-sensitive but needs quality. 'fast' uses Aliyun/Default.
                schema: GeneratedArticleSchema,
                system: ARTICLE_GENERATION_PROMPT,
                prompt: userPrompt,
            });

            log.info({ provider, title: article.title }, 'Article generated successfully');
            return article;
        } catch (error) {
            logAIError({
                error,
                systemPrompt: ARTICLE_GENERATION_PROMPT,
                userPrompt,
                rawResponse,
                model: 'AIService',
                context: 'ArticleAIService.generateArticle 调用失败',
            });

            throw error;
        }
    }

    /**
     * 获取当前使用的模型名称
     */
    getModelName(): string {
        return 'AIService';
    }
}
