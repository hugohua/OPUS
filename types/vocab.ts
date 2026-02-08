/**
 * 核心词汇实体定义 (Core Vocabulary Entity)
 * ============================================
 * 
 * 统一 DB (Prisma) 与 AI 生成器之间的数据结构。
 * 避免在各处重复定义 { word, definition, collocations, ... }
 */

/**
 * 基础词汇信息 (最小集)
 * 适用于列表展示、简单生成
 */
export interface BaseVocab {
    vocabId: number;
    word: string;
    definition_cn: string | null;
}

/**
 * 完整词汇实体 (用于 Drill 生成)
 * 包含搭配词、词族、词性等富信息
 */
export interface VocabEntity extends BaseVocab {
    word_family?: Record<string, string> | null;
    collocations?: CollocationItem[] | null;
    partOfSpeech?: string | null;
    difficulty?: number; // FSRS difficulty
    // 扩展字段...
}

/**
 * Collocation 数据项 (标准化)
 * 兼容 DB 存储的 JSON 结构: string | { text: string } | { word: string }
 */
export type CollocationItem = string | { text: string } | { word: string };
