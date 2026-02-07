import { createOpenAI } from '@ai-sdk/openai';
import { createProxyFetch } from '@/lib/ai/client'; // Reuse existing proxy fetch logic
import { createLogger } from '@/lib/logger';

const log = createLogger('ai-providers');

export type AIProviderId = 'aliyun' | 'openrouter' | 'gemini';

export interface AIProviderConfig {
    id: AIProviderId;
    modelId: string;
    apiKey: string;
    baseURL: string;
    proxy?: string;
}

export class ProviderRegistry {
    /**
     * Create an AI SDK Model instance from config
     */
    static createModel(config: AIProviderConfig) {
        // Configure proxy if needed
        const fetch = config.proxy ? createProxyFetch(config.proxy) : undefined;

        const client = createOpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            fetch,
        });

        return client.chat(config.modelId);
    }

    /**
     * Get ordered provider list based on mode
     * 
     * Controlled by Env Vars:
     * - `AI_FAST_ORDER`: Comma-separated list for Fast mode (e.g. "aliyun,openrouter")
     * - `AI_SMART_ORDER`: Comma-separated list for Smart mode (e.g. "openrouter,aliyun")
     * 
     * 'long' mode follows Fast mode order, but applies long-context model override where applicable.
     */
    static getFailoverList(mode: 'fast' | 'smart' | 'long' = 'fast'): AIProviderConfig[] {
        // 1. Define available provider pools
        const pool: Record<string, AIProviderConfig> = {};

        // Aliyun (Primary Domestic)
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL) {
            pool['aliyun'] = {
                id: 'aliyun',
                modelId: process.env.AI_MODEL_NAME || 'qwen-turbo',
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_BASE_URL,
            };
        }

        // OpenRouter (Primary ETL)
        if (process.env.ETL_API_KEY && process.env.ETL_BASE_URL) {
            pool['openrouter'] = {
                id: 'openrouter',
                modelId: process.env.ETL_MODEL_NAME || 'google/gemini-flash-1.5',
                apiKey: process.env.ETL_API_KEY,
                baseURL: process.env.ETL_BASE_URL,
                proxy: process.env.HTTPS_PROXY,
            };
        }

        // 2. Determine Category
        const isSmart = mode === 'smart';
        const category = isSmart ? 'SMART' : 'FAST';

        // 3. Resolve Order from Env
        // Default Fast: Aliyun -> OpenRouter
        // Default Smart: OpenRouter -> Aliyun
        const defaultOrder = isSmart ? ['openrouter', 'aliyun'] : ['aliyun', 'openrouter'];

        const envOrderStr = process.env[`AI_${category}_ORDER`];
        const order = envOrderStr
            ? envOrderStr.split(',').map(s => s.trim().toLowerCase())
            : defaultOrder;

        const list: AIProviderConfig[] = [];

        // 4. Build List based on Order
        for (const providerId of order) {
            const config = pool[providerId];
            if (config) {
                const activeConfig = { ...config };

                // Apply model overrides
                if (providerId === 'aliyun') {
                    if (mode === 'long') {
                        activeConfig.modelId = 'qwen-long';
                    }
                    // For 'fast', use env configured AI_MODEL_NAME
                }
                // OpenRouter uses ETL_MODEL_NAME

                list.push(activeConfig);
            }
        }

        // 5. Hard Fallback? 
        // If the user manually set an order that excludes available providers, we strictly follow their order.
        // If defaults were used, we might want to ensure at least one exists.

        if (list.length === 0) {
            log.warn({ mode, order, available: Object.keys(pool) }, 'No configured providers found for requested order');
            // Emergency fallback: add anything available
            Object.values(pool).forEach(p => list.push(p));
        }

        return list;
    }
}
