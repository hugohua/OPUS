import { generateText } from 'ai';
import { VocabularyResultSchema } from '@/lib/validations/ai';
import type { VocabularyInput, VocabularyResult } from '@/types/ai';
import { VOCABULARY_ENRICHMENT_PROMPT } from '@/lib/prompts/vocabulary';
import { safeParse } from './utils';
import { createLogger, logAIError } from '@/lib/logger';
import { getAIModel } from './client';

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
    private model;
    private modelName: string;

    constructor() {
        // 使用集中式工厂创建 ETL 专用模型实例
        const { model, modelName } = getAIModel('etl');
        this.model = model;
        this.modelName = modelName;

        log.info({ model: this.modelName }, 'VocabularyAIService initialized');
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
            const { text } = await generateText({
                model: this.model,
                system: VOCABULARY_ENRICHMENT_PROMPT,
                prompt: userPrompt,
                temperature: 0.1, // 低温度确保 ETL 输出一致性
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

