import { embedMany } from 'ai';
import { createLogger, logAIError } from '@/lib/logger';
import { getEmbeddingModel } from './client';

const log = createLogger('vectorization-service');

export interface VocabInput {
    word: string;
    definition_cn: string | null;
    definitions: any; // Json
    scenarios: string[];
    synonyms: string[];
    collocations: any; // Json
}

/**
 * 向量化服务 (Service Layer)
 * 
 * 职责:
 * 1. 构造 "Semantic Composite Text" (核心语义策略)
 * 2. 对接 AI 模型生成 Embeddings
 */
export class VectorizationService {
    private model;
    private modelName: string;

    constructor() {
        // 使用 ETL 场景配置 (通常向量化是后台任务)
        const { model, modelName } = getEmbeddingModel('etl');
        this.model = model;
        this.modelName = modelName;
        log.info({ model: this.modelName }, 'VectorizationService initialized');
    }

    /**
     * 构造 "Semantic Composite Text"
     * 策略: Word + Meaning + Business Meaning + Context + Synonyms + Usage
     */
    constructEmbeddingPayload(vocab: VocabInput): string {
        const parts: string[] = [];

        // 1. 核心词与简明释义 (权重最高)
        parts.push(`Word: ${vocab.word}`);
        parts.push(`Meaning: ${vocab.definition_cn || 'Unknown'}`);

        // 2. 商务深度释义 (关键修正)
        if (vocab.definitions && typeof vocab.definitions === 'object' && !Array.isArray(vocab.definitions)) {
            const defs = vocab.definitions as Record<string, string>;
            // 优先取 business_cn，降级取 general_cn
            const businessMeaning = defs.business_cn || defs.general_cn;
            if (businessMeaning) {
                parts.push(`Business Meaning: ${businessMeaning}`);
            }
        }

        // 3. 场景标签 (定位领域)
        if (vocab.scenarios && vocab.scenarios.length > 0) {
            parts.push(`Context: ${vocab.scenarios.join(', ')}`);
        }

        // 4. 近义词 (扩展网络)
        if (vocab.synonyms && vocab.synonyms.length > 0) {
            // 限制数量，防止噪音
            parts.push(`Synonyms: ${vocab.synonyms.slice(0, 5).join(', ')}`);
        }

        // 5. 高频搭配 (Chunk 语义)
        if (vocab.collocations && Array.isArray(vocab.collocations)) {
            const chunks = (vocab.collocations as any[])
                .slice(0, 5) // 只取前5个最重要的
                .map(c => c.text)
                .join(', ');

            if (chunks) {
                parts.push(`Usage: ${chunks}`);
            }
        }

        // 最终拼接使用 ". " 分隔，更像自然语言
        return parts.join('. ');
    }

    /**
     * 批量生成向量
     */
    async embedMany(items: VocabInput[]): Promise<number[][]> {
        if (items.length === 0) return [];

        const values = items.map(item => this.constructEmbeddingPayload(item));

        try {
            const { embeddings } = await embedMany({
                model: this.model,
                values: values,
            });

            return embeddings;

        } catch (error) {
            logAIError({
                error,
                systemPrompt: 'N/A (Embedding)',
                userPrompt: `Batch size: ${items.length}, First word: ${items[0].word}`,
                rawResponse: 'N/A',
                model: this.modelName,
                context: 'VectorizationService.embedMany failed'
            });
            throw error;
        }
    }
}
