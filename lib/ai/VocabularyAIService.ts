import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { VocabularyResultSchema } from '@/lib/validations/ai';
import type { VocabularyInput, VocabularyResult } from '@/types/ai';
import { VOCABULARY_ENRICHMENT_PROMPT } from './prompts';
import { safeParse } from './utils';
import { createLogger, logAIError } from '@/lib/logger';

// Proxy support
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch, { RequestInit as NodeFetchRequestInit } from 'node-fetch';

const log = createLogger('ai');

/**
 * 合法的场景标签白名单（与 PRD 保持一致）
 */
const VALID_SCENARIOS = new Set([
    "recruitment", "personnel", "management", "office_admin", "finance",
    "investment", "tax_accounting", "legal", "logistics", "manufacturing",
    "procurement", "quality_control", "marketing", "sales", "customer_service",
    "negotiation", "business_travel", "dining_events", "technology",
    "real_estate", "general_business"
]);

/**
 * 清洗 AI 响应文本，过滤非法的 scenario 标签
 * 防止 AI "抽风" 生成 human_resources 等非法值导致 Zod 校验失败
 * 
 * @param text - AI 返回的原始 JSON 文本
 * @returns 清洗后的 JSON 文本
 */
function sanitizeAIResponseText(text: string): string {
    try {
        // 尝试解析 JSON（可能被 markdown 包裹）
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const rawData = JSON.parse(jsonText);

        if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.items)) {
            return text; // 结构不符，直接返回原文
        }

        const sanitizedData = {
            ...rawData,
            items: rawData.items.map((item: Record<string, unknown>) => {
                if (!item || typeof item !== 'object') return item;

                const scenarios = item.scenarios;
                if (!Array.isArray(scenarios)) return item;

                const validScenarios = scenarios.filter((tag: unknown) => {
                    if (typeof tag === 'string' && VALID_SCENARIOS.has(tag)) {
                        return true;
                    }
                    log.warn({ word: item.word, invalidTag: tag }, '⚠️ Dropped invalid scenario tag');
                    return false;
                });

                return {
                    ...item,
                    scenarios: validScenarios
                };
            })
        };

        return JSON.stringify(sanitizedData);
    } catch {
        // JSON 解析失败，返回原文让后续的 safeParse 处理
        return text;
    }
}

/**
 * 创建带代理的 fetch 函数（仅用于 AI 调用）
 * 使用 node-fetch 替代原生 fetch，因为原生 fetch 不支持 agent
 */
function createProxyFetch(): typeof fetch | undefined {
    const proxyUrl = process.env.HTTPS_PROXY;

    if (!proxyUrl) {
        return undefined; // 不使用代理，使用默认 fetch
    }

    log.info({ proxy: proxyUrl }, 'Proxy enabled for AI requests');
    const agent = new HttpsProxyAgent(proxyUrl);

    // 使用 node-fetch 并注入代理 agent
    const proxyFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();

        const nodeFetchInit: NodeFetchRequestInit = {
            method: init?.method,
            headers: init?.headers as NodeFetchRequestInit['headers'],
            body: init?.body as NodeFetchRequestInit['body'],
            agent, // 注入代理
        };

        const response = await nodeFetch(url, nodeFetchInit);

        // 将 node-fetch Response 转换为标准 Response
        return response as unknown as Response;
    };

    return proxyFetch;
}

/**
 * 词汇 AI 增强服务
 * 
 * 使用 AI 模型处理词汇数据，生成：
 * - 简明中文释义 (definition_cn)
 * - 结构化释义 (definitions)
 * - 商务场景标签 (scenarios)
 * - 常用搭配 (collocations)
 * 
 * 支持 HTTPS_PROXY 环境变量配置代理（仅用于 AI 请求）
 */
export class VocabularyAIService {
    private model;
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || process.env.AI_MODEL_NAME || 'qwen-plus';

        // 创建 OpenAI 客户端，可选注入代理 fetch
        const proxyFetch = createProxyFetch();

        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
            ...(proxyFetch && { fetch: proxyFetch }),
        });

        this.model = openai.chat(this.modelName);
    }

    /**
     * 批量增强词汇元数据
     * @param inputs - 待处理的词汇列表
     * @returns 增强后的词汇结果
     */
    async enrichVocabulary(inputs: VocabularyInput[]): Promise<VocabularyResult> {
        const words = inputs.map(i => i.word);
        log.info({ wordCount: inputs.length, model: this.modelName, words }, 'Processing vocabulary batch');

        const userPrompt = JSON.stringify(inputs);
        let rawResponse: string | undefined;

        try {
            const { text } = await generateText({
                model: this.model,
                system: VOCABULARY_ENRICHMENT_PROMPT,
                prompt: userPrompt,
            });

            rawResponse = text;
            log.debug({ responseLength: text.length }, 'AI response received, parsing');

            // 预处理：清洗 AI 响应，过滤非法 scenario 标签（纵深防御）
            const sanitizedText = sanitizeAIResponseText(text);

            return safeParse(sanitizedText, VocabularyResultSchema, {
                systemPrompt: VOCABULARY_ENRICHMENT_PROMPT,
                userPrompt,
                model: this.modelName,
            });
        } catch (error) {
            // 记录详细错误日志
            logAIError({
                error,
                systemPrompt: VOCABULARY_ENRICHMENT_PROMPT,
                userPrompt,
                rawResponse,
                model: this.modelName,
                context: 'VocabularyAIService.enrichVocabulary 调用失败',
            });

            // 重新抛出错误，让上层处理
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

