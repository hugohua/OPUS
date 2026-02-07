import { AIService } from './core';
import { VocabularyResultSchema } from '@/lib/validations/ai';
import type { VocabularyInput, VocabularyResult } from '@/types/ai';
import { VOCABULARY_ENRICHMENT_PROMPT } from '@/lib/generators/etl/vocabulary';
import { createLogger, logAIError } from '@/lib/logger';

const log = createLogger('ai');

// [Removed] sanitizeAIResponseText is no longer needed as AIService.generateObject handles validation.
// If validScenarios filtering is strictly required, we should implement it via Zod transform or refine.
// For now, we rely on the generic schema validation.

/**
 * 词汇 AI 增强服务
 * 
 * 使用 AI 模型处理词汇数据，生成：
 * - 简明中文释义 (definition_cn)
 * - 结构化释义 (definitions: { business_cn, general_cn })
 * - 优先级分类 (priority: CORE/SUPPORT/NOISE)
 * - 商务场景标签 (scenarios)
 * - 常用搭配 (collocations)
 * - 词族变形 (word_family: { n, v, adj, adv })
 * - 易混淆词 (confusing_words)
 * - 商务近义词 (synonyms)
 * 
 * 支持 HTTPS_PROXY 环境变量配置代理（仅用于 AI 请求）
 */
export class VocabularyAIService {
    constructor() {
        log.info('VocabularyAIService initialized (Unified AI)');
    }

    /**
     * 批量增强词汇元数据
     * @param inputs - 待处理的词汇列表
     * @returns 增强后的词汇结果
     */
    async enrichVocabulary(inputs: VocabularyInput[]): Promise<VocabularyResult> {
        const words = inputs.map(i => i.word);

        const userPrompt = JSON.stringify(inputs);
        let rawResponse: string | undefined;

        try {
            const { object: result, provider } = await AIService.generateObject({
                mode: 'smart', // ETL uses Smart/OpenRouter
                schema: VocabularyResultSchema,
                system: VOCABULARY_ENRICHMENT_PROMPT,
                prompt: userPrompt,
                temperature: 0.1, // Supported now
            });

            log.info({ provider, count: result.items.length }, 'Vocabulary enriched successfully');
            return result;
        } catch (error) {
            // 记录详细错误日志
            logAIError({
                error,
                systemPrompt: VOCABULARY_ENRICHMENT_PROMPT,
                userPrompt,
                rawResponse,
                model: 'AIService',
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
        return 'AIService';
    }
}

