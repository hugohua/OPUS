import { generateText, generateObject, LanguageModel } from 'ai';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { ProviderRegistry, AIProviderConfig } from './providers';
import { auditLLMFailover } from '@/lib/services/audit-service';

const log = createLogger('ai-core');

export type AIMode = 'fast' | 'smart';

/**
 * Failover 上下文，传递给操作函数
 */
interface FailoverContext {
    model: LanguageModel;
    config: AIProviderConfig;
}

/**
 * Failover 选项
 */
interface FailoverOptions {
    mode: AIMode;
    userId?: string; // 可选，用于审计追溯
    logPrefix?: string; // 日志前缀，用于区分调用类型
}

export class AIService {
    /**
     * 通用 Failover 执行器
     * 抽取公共的 Provider 遍历、错误处理、审计逻辑
     */
    private static async withFailover<T>(
        options: FailoverOptions,
        operation: (ctx: FailoverContext) => Promise<T>
    ): Promise<{ result: T; provider: string }> {
        const { mode, userId, logPrefix = 'AI' } = options;
        const providers = ProviderRegistry.getFailoverList(mode);

        if (providers.length === 0) {
            throw new Error('No AI providers configured');
        }

        let lastError: any;
        let attemptNumber = 0;

        for (const config of providers) {
            attemptNumber++;
            try {
                log.info({ provider: config.id, mode }, `${logPrefix}: Attempting generation`);

                const model = ProviderRegistry.createModel(config);
                const result = await operation({ model, config });

                log.info({ provider: config.id }, `${logPrefix}: Generation successful`);
                return { result, provider: config.id };

            } catch (error) {
                lastError = error;
                const errorMsg = error instanceof Error ? error.message : String(error);
                log.warn({ provider: config.id, error: errorMsg }, `${logPrefix}: Generation failed, trying next provider`);

                // 计算下一个 Provider (如果存在)
                const nextProvider = providers[attemptNumber] || null;

                // 记录 Failover 审计
                auditLLMFailover(
                    userId || null,
                    config.id,
                    nextProvider?.id || null,
                    errorMsg,
                    {
                        mode,
                        attemptNumber,
                        totalProviders: providers.length
                    }
                );

                continue;
            }
        }

        throw lastError || new Error('All AI providers failed');
    }

    /**
     * 文本生成 (含 Failover)
     */
    static async generateText(options: {
        mode?: AIMode;
        userId?: string;
        system?: string;
        prompt: string;
        temperature?: number;
    }): Promise<{ text: string; provider: string }> {
        const mode = options.mode || 'fast';

        const { result, provider } = await this.withFailover(
            { mode, userId: options.userId, logPrefix: 'AI:Text' },
            async ({ model }) => {
                const res = await generateText({
                    model,
                    system: options.system,
                    prompt: options.prompt,
                    temperature: options.temperature,
                });
                return res.text;
            }
        );

        return { text: result, provider };
    }

    /**
     * 结构化生成 (含 Failover)
     * 确保泛型 T 能正确推导，无需业务层强转
     */
    static async generateObject<T>(options: {
        mode?: AIMode;
        userId?: string;
        schema: z.ZodType<T>;
        system?: string;
        prompt: string;
        temperature?: number;
    }): Promise<{ object: T; provider: string }> {
        const mode = options.mode || 'fast';

        const { result, provider } = await this.withFailover(
            { mode, userId: options.userId, logPrefix: 'AI:Object' },
            async ({ model }) => {
                const res = await generateObject({
                    model,
                    schema: options.schema,
                    system: options.system,
                    prompt: options.prompt,
                    temperature: options.temperature,
                });
                return res.object;
            }
        );

        return { object: result, provider };
    }
}
