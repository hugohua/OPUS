/**
 * Drill 输入构建器 (Input Builders)
 * ===================================
 * 
 * 共享模块：提供统一的输入构建逻辑，供 drill-processor 和 debug-prompt 复用。
 * 确保生产环境和调试工具使用完全相同的输入格式。
 */

import { ContextSelector } from '@/lib/ai/context-selector';
import { SyntaxGeneratorInput } from '@/lib/generators/l0/syntax';
import { PhraseGeneratorInput } from '@/lib/generators/l0/phrase';
import { BlitzGeneratorInput } from '@/lib/generators/l0/blitz';
import { logger } from '@/lib/logger';
import { VocabEntity, CollocationItem } from '@/types/vocab';
import { VisualTrapService } from '@/lib/services/visual-trap';

const log = logger.child({ module: 'input-builders' });

// ============================================
// 通用类型定义 (已迁移至 types/vocab.ts)
// ============================================
// export interface VocabCandidate ... 
// export type CollocationItem ... 


// ============================================
// L0 Syntax 输入构建
// ============================================

/**
 * 构建 L0 Syntax 输入 (生产级)
 * 
 * @param userId 用户ID (用于语义向量检索)
 * @param candidate 词汇候选项
 * @returns SyntaxGeneratorInput
 */
export async function buildSyntaxInput(
    userId: string,
    candidate: VocabEntity
): Promise<SyntaxGeneratorInput> {
    // 使用 ContextSelector 进行语义检索，失败时从 collocations 兜底
    const contextWords = await getContextWords(
        userId,
        candidate.vocabId,
        candidate.word,
        candidate.collocations // 传递兜底数据源
    );

    return {
        targetWord: candidate.word,
        meaning: candidate.definition_cn || '暂无释义',
        contextWords,
        wordFamily: (candidate.word_family as Record<string, string>) || {},
    };
}

/**
 * 构建 L0 Syntax 输入 (简化版，仅用于调试)
 * 不调用 ContextSelector，直接从 collocations 提取
 * 
 * @param candidate 词汇候选项
 * @returns SyntaxGeneratorInput
 */
export function buildSyntaxInputSimple(candidate: VocabEntity): SyntaxGeneratorInput {
    const contextWords = extractCollocations(candidate.collocations).slice(0, 3);

    return {
        targetWord: candidate.word,
        meaning: candidate.definition_cn || '暂无释义',
        contextWords,
        wordFamily: (candidate.word_family as Record<string, string>) || {},
    };
}

// ============================================
// L0 Phrase 输入构建
// ============================================

/**
 * 构建 L0 Phrase 输入
 */
export function buildPhraseInput(candidate: VocabEntity): PhraseGeneratorInput {
    const modifiers = extractCollocations(candidate.collocations).slice(0, 3);

    return {
        targetWord: candidate.word,
        meaning: candidate.definition_cn || '暂无释义',
        modifiers: modifiers.length > 0 ? modifiers : ['frequently', 'highly', 'effectively'],
    };
}

// ============================================
// L0 Blitz 输入构建
// ============================================

/**
 * 构建 L0 Blitz 输入
 * 注意: 视觉干扰词 (distractors) 由 drill-processor 通过 VisualTrapService 单独生成
 */
export function buildBlitzInput(candidate: VocabEntity): BlitzGeneratorInput {
    const collocations = extractCollocations(candidate.collocations).slice(0, 3);

    return {
        targetWord: candidate.word,
        meaning: candidate.definition_cn || '',
        collocations: collocations.length > 0 ? collocations : ['(missing collocation)'],
    };
}

/**
 * 构建 L0 Blitz 输入 (带视觉干扰词)
 * 
 * 封装 VisualTrapService 调用，确保生产环境和调试工具使用相同逻辑。
 * 
 * Fail-Safe 机制：
 * - 若 VisualTrapService 失败，返回空数组作为 distractors
 * - 确保整个 batch 不会因单个词的 trap 生成失败而中断
 * 
 * @param candidate 词汇候选项
 * @returns BlitzGeneratorInputWithTraps (包含 distractors)
 */
export async function buildBlitzInputWithTraps(
    candidate: VocabEntity
): Promise<BlitzGeneratorInputWithTraps> {
    const collocations = extractCollocations(candidate.collocations).slice(0, 3);

    // [Fail-Safe] 捕获 VisualTrapService 异常，避免整个 batch 失败
    let distractors: string[] = [];
    try {
        distractors = await VisualTrapService.generate(candidate.word, 3);
    } catch (e) {
        log.warn(
            { word: candidate.word, error: String(e) },
            'VisualTrap generation failed, using empty fallback'
        );
        // Fallback: 空数组（LLM Prompt 会自动处理此情况）
        distractors = [];
    }

    return {
        targetWord: candidate.word,
        meaning: candidate.definition_cn || '',
        collocations: collocations.length > 0 ? collocations : ['(missing collocation)'],
        distractors
    };
}

/**
 * Blitz 输入（带视觉干扰词）
 * 继承自 BlitzGeneratorInput，添加 distractors 字段
 */
export interface BlitzGeneratorInputWithTraps extends BlitzGeneratorInput {
    distractors: string[];
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取上下文单词 (语义向量检索)
 * 策略 (Hybrid):
 * 1. 从 UserProgress 中找语义相关的 (Vector Search)
 * 2. 从 Global Vocab 中找语义相关的 (Vector Search)
 * 3. 兜底：从 collocations 提取
 */
export async function getContextWords(
    userId: string,
    targetVocabId: number,
    targetWord: string,
    fallbackCollocations?: CollocationItem[] | null
): Promise<string[]> {
    try {
        const selectorResult = await ContextSelector.select(userId, targetVocabId, {
            count: 3,
            strategies: ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'],
            minDistance: 0.15,
            maxDistance: 0.5,
            excludeIds: [targetVocabId]
        });

        return selectorResult.map(v => v.word);
    } catch (e) {
        log.error({ error: String(e), targetWord }, 'ContextSelector failed');

        // Pivot Rule: 从 collocations 提取
        if (fallbackCollocations) {
            const fallback = extractCollocations(fallbackCollocations).slice(0, 3);
            if (fallback.length > 0) {
                log.info({ targetWord, count: fallback.length }, 'Using collocation fallback');
                return fallback;
            }
        }

        return [];
    }
}

/**
 * 从 collocations 提取字符串数组
 * 支持多种格式: string[], { text: string }[], { word: string }[]
 */
export function extractCollocations(raw: any): string[] {
    if (!raw) return [];

    if (Array.isArray(raw)) {
        return raw
            .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item?.text) return item.text;
                if (item?.word) return item.word;
                return null;
            })
            .filter((x): x is string => x !== null);
    }

    return [];
}
