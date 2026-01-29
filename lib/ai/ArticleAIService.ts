import 'server-only';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { GeneratedArticleSchema } from '@/lib/validations/article';
import type { ArticleGenerationInput, GeneratedArticle } from '@/types/article';
import { ARTICLE_GENERATION_PROMPT } from '@/lib/generators/etl/article';
import { safeParse } from './utils';
import { createLogger, logAIError } from '@/lib/logger';

// Proxy support
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch, { RequestInit as NodeFetchRequestInit } from 'node-fetch';

const log = createLogger('article-ai');

/**
 * 创建带代理的 fetch 函数（仅用于 AI 调用）
 */
function createProxyFetch(): typeof fetch | undefined {
    const proxyUrl = process.env.HTTPS_PROXY;

    if (!proxyUrl) {
        return undefined;
    }

    log.info({ proxy: proxyUrl }, 'Proxy enabled for AI requests');
    const agent = new HttpsProxyAgent(proxyUrl);

    const proxyFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();

        const nodeFetchInit: NodeFetchRequestInit = {
            method: init?.method,
            headers: init?.headers as NodeFetchRequestInit['headers'],
            body: init?.body as NodeFetchRequestInit['body'],
            agent,
        };

        const response = await nodeFetch(url, nodeFetchInit);
        return response as unknown as Response;
    };

    return proxyFetch;
}

/**
 * 文章 AI 生成服务
 * 
 * 使用 AI 模型根据选词结果生成商务英语短文
 */
export class ArticleAIService {
    private model;
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || process.env.AI_MODEL_NAME || 'qwen-plus';

        const proxyFetch = createProxyFetch();

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
            ...(proxyFetch && { fetch: proxyFetch }),
        });

        this.model = openai.chat(this.modelName);
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
            model: this.modelName,
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
            const { text } = await generateText({
                model: this.model,
                system: ARTICLE_GENERATION_PROMPT,
                prompt: userPrompt,
            });

            rawResponse = text;
            log.debug({ responseLength: text.length }, 'AI response received, parsing');

            return safeParse(text, GeneratedArticleSchema, {
                systemPrompt: ARTICLE_GENERATION_PROMPT,
                userPrompt,
                model: this.modelName,
            });
        } catch (error) {
            logAIError({
                error,
                systemPrompt: ARTICLE_GENERATION_PROMPT,
                userPrompt,
                rawResponse,
                model: this.modelName,
                context: 'ArticleAIService.generateArticle 调用失败',
            });

            throw error;
        }
    }

    /**
     * 获取当前使用的模型名称
     */
    getModelName(): string {
        return this.modelName;
    }
}
