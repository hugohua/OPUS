/**
 * LLM 多厂商切换模块
 * 功能：
 *   按优先级尝试多个 LLM Provider，实现自动 Failover
 * 支持厂商：
 *   - aliyun: 阿里云 DashScope (qwen-plus)
 *   - openrouter: OpenRouter (gemini-3-flash 等)
 *   - gemini: Google Gemini 直连（需代理）
 * 配置：
 *   AI_PROVIDER_ORDER=aliyun,openrouter,gemini
 */
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { logger } from '@/lib/logger';

interface LLMProvider {
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    proxy?: string;
}

// Provider 配置映射
const PROVIDER_CONFIG: Record<string, () => LLMProvider | null> = {
    aliyun: () => {
        if (!process.env.OPENAI_API_KEY) return null;
        return {
            name: 'aliyun',
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            model: process.env.AI_MODEL_NAME || 'qwen-plus',
        };
    },
    openrouter: () => {
        if (!process.env.ETL_API_KEY) return null;
        return {
            name: 'openrouter',
            apiKey: process.env.ETL_API_KEY,
            baseURL: process.env.ETL_BASE_URL || 'https://openrouter.ai/api/v1',
            model: process.env.ETL_MODEL_NAME || 'google/gemini-3-flash-preview',
        };
    },
    gemini: () => {
        if (!process.env.GEMINI_API_KEY) return null;
        return {
            name: 'gemini',
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
            model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash-exp',
            proxy: process.env.GEMINI_HTTPS_PROXY, // Gemini 需要代理
        };
    },
};

/**
 * 获取排序后的可用 Provider 列表
 */
function getOrderedProviders(): LLMProvider[] {
    const order = (process.env.AI_PROVIDER_ORDER || 'aliyun,openrouter')
        .split(',')
        .map(s => s.trim());

    const providers: LLMProvider[] = [];

    for (const name of order) {
        const factory = PROVIDER_CONFIG[name];
        if (factory) {
            const provider = factory();
            if (provider) {
                providers.push(provider);
            }
        }
    }

    return providers;
}

/**
 * 带 Failover 的 LLM 调用
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @returns 生成结果和使用的 Provider
 */
export async function generateWithFailover(
    systemPrompt: string,
    userPrompt: string
): Promise<{ text: string; provider: string }> {
    const providers = getOrderedProviders();

    if (providers.length === 0) {
        throw new Error('没有可用的 LLM Provider，请检查环境变量配置');
    }

    for (const provider of providers) {
        try {
            logger.info({ provider: provider.name, model: provider.model }, 'LLM: 尝试调用');

            // 配置代理（仅 Gemini 使用）
            if (provider.proxy) {
                process.env.HTTPS_PROXY = provider.proxy;
            }

            const client = createOpenAI({
                apiKey: provider.apiKey,
                baseURL: provider.baseURL,
            });

            const result = await generateText({
                model: client.chat(provider.model),
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            });

            // 清除代理设置
            if (provider.proxy) {
                delete process.env.HTTPS_PROXY;
            }

            logger.info({ provider: provider.name, tokens: result.usage }, 'LLM: 调用成功');
            return { text: result.text, provider: `${provider.name} (${provider.model})` };

        } catch (error) {
            // 清除代理设置
            if (provider.proxy) {
                delete process.env.HTTPS_PROXY;
            }

            logger.warn(
                { provider: provider.name, error: (error as Error).message },
                'LLM: 调用失败，尝试下一个'
            );
            continue;
        }
    }

    throw new Error('所有 LLM Provider 均不可用');
}
