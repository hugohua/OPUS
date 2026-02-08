import { generateText, generateObject, LanguageModel } from 'ai';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { ProviderRegistry, AIProviderConfig } from './providers';
import { auditLLMFailover } from '@/lib/services/audit-service';
import { safeParse, AIParseError } from './utils';

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

                // 提取完整错误上下文（AI SDK 错误通常包含 cause 和 response）
                let errorDetails: Record<string, any> = {};
                if (error instanceof Error) {
                    // 优先处理 AIParseError（携带原始 LLM 响应）
                    if (error instanceof AIParseError) {
                        errorDetails.rawLLMResponse = error.rawResponse.slice(0, 3000); // 保留更多内容用于调试
                        if (error.zodError) {
                            errorDetails.zodIssues = error.zodError.issues.slice(0, 5); // 前 5 个问题
                        }
                    }

                    // AI SDK 错误结构
                    const aiError = error as any;
                    if (aiError.cause) {
                        errorDetails.cause = String(aiError.cause).slice(0, 1000);
                    }
                    if (aiError.response) {
                        errorDetails.response = typeof aiError.response === 'string'
                            ? aiError.response.slice(0, 2000)
                            : JSON.stringify(aiError.response).slice(0, 2000);
                    }
                    if (aiError.text) {
                        errorDetails.rawText = aiError.text.slice(0, 2000);
                    }
                    if (aiError.rawResponse) {
                        errorDetails.rawResponse = JSON.stringify(aiError.rawResponse).slice(0, 2000);
                    }
                    // 完整错误栈（便于调试）
                    errorDetails.stack = error.stack?.slice(0, 500);
                }

                log.warn({
                    provider: config.id,
                    error: errorMsg,
                    details: errorDetails
                }, `${logPrefix}: Generation failed, trying next provider`);

                // 计算下一个 Provider (如果存在)
                const nextProvider = providers[attemptNumber] || null;

                // 记录 Failover 审计（含完整错误上下文）
                auditLLMFailover(
                    userId || null,
                    config.id,
                    nextProvider?.id || null,
                    errorMsg,
                    {
                        mode,
                        attemptNumber,
                        totalProviders: providers.length,
                        errorDetails // 新增：完整错误上下文
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
     * 结构化生成 (含 Failover + Markdown 剥离)
     * 
     * 策略：使用 generateText 获取原始响应，再用 safeParse 手动解析
     * 这样可以兼容返回 Markdown 包裹 JSON 的 LLM（如 Gemini via 本地代理）
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

        const { result, provider } = await this.withFailover<T>(
            { mode, userId: options.userId, logPrefix: 'AI:Object' },
            async ({ model, config }): Promise<T> => {
                // 使用 generateText 获取原始响应
                const res = await generateText({
                    model,
                    system: options.system,
                    prompt: options.prompt,
                    temperature: options.temperature,
                });

                // 使用 safeParse 剥离 Markdown 并解析 JSON
                const parsed = safeParse<T>(res.text, options.schema, {
                    systemPrompt: options.system,
                    userPrompt: options.prompt,
                    model: config.id
                });

                // ✅ 空数据防御：如果解析成功但 items 为空，触发 Failover
                if (parsed && typeof parsed === 'object' && 'items' in parsed) {
                    const items = (parsed as any).items;
                    if (Array.isArray(items) && items.length === 0) {
                        throw new Error('AI returned empty items array, triggering failover');
                    }
                }

                return parsed;
            }
        );

        return { object: result, provider };
    }
}
