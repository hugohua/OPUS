import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { ProviderRegistry, AIProviderConfig } from './providers';

const log = createLogger('ai-core');

export type AIMode = 'fast' | 'smart';

export class AIService {
    /**
     * 文本生成 (含 Failover)
     */
    static async generateText(options: {
        mode?: AIMode; // default: 'fast'
        system?: string;
        prompt: string;
        temperature?: number;
        // ... passthrough options
    }): Promise<{ text: string; provider: string }> {
        const mode = options.mode || 'fast';
        const providers = ProviderRegistry.getFailoverList(mode);

        if (providers.length === 0) {
            throw new Error('No AI providers configured');
        }

        let lastError: any;

        for (const config of providers) {
            try {
                log.info({ provider: config.id, mode }, 'AI: Attempting generation');

                const model = ProviderRegistry.createModel(config);
                const result = await generateText({
                    model,
                    system: options.system,
                    prompt: options.prompt,
                    temperature: options.temperature,
                });

                log.info({ provider: config.id, usage: result.usage }, 'AI: Generation successful');
                return { text: result.text, provider: config.id };

            } catch (error) {
                lastError = error;
                log.warn({ provider: config.id, error }, 'AI: Generation failed, trying next provider');
                continue;
            }
        }

        throw lastError || new Error('All AI providers failed');
    }

    /**
     * 结构化生成 (含 Failover)
     * 确保泛型 T 能正确推导，无需业务层强转
     */
    static async generateObject<T>(options: {
        mode?: AIMode;
        schema: z.ZodType<T>;
        system?: string;
        prompt: string;
        temperature?: number;
    }): Promise<{ object: T; provider: string }> {
        const mode = options.mode || 'fast';
        const providers = ProviderRegistry.getFailoverList(mode);

        if (providers.length === 0) {
            throw new Error('No AI providers configured');
        }

        let lastError: any;

        for (const config of providers) {
            try {
                log.info({ provider: config.id, mode }, 'AI: Attempting object generation');

                const model = ProviderRegistry.createModel(config);
                const result = await generateObject({
                    model,
                    schema: options.schema,
                    system: options.system,
                    prompt: options.prompt,
                    temperature: options.temperature,
                });

                log.info({ provider: config.id, usage: result.usage }, 'AI: Object generation successful');
                return { object: result.object, provider: config.id };

            } catch (error) {
                lastError = error;
                log.warn({ provider: config.id, error }, 'AI: Object generation failed, trying next provider');
                continue;
            }
        }

        throw lastError || new Error('All AI providers failed');
    }
}
