/**
 * Deterministic Drill 模板引擎
 * 功能：
 *   库存为空时，使用数据库数据构建最小可用 Drill（不依赖 LLM）
 * 原则：
 *   100% 确定性，零延迟
 */
import { db } from '@/lib/db';
import { BriefingPayload, SessionMode } from '@/types/briefing';

/**
 * 构建降级 Drill
 * @param userId 用户 ID
 * @param mode Session 模式
 * @param limit 数量限制
 */
export async function buildDeterministicDrill(
    userId: string,
    mode: SessionMode,
    limit: number = 5
): Promise<BriefingPayload[]> {
    // 获取待学习词汇（优先复习队列）
    const words = await fetchWordsForDrill(userId, mode, limit);

    if (words.length === 0) {
        // 兜底：随机获取一些词汇
        const fallbackWords = await db.vocab.findMany({
            where: { is_toeic_core: true },
            take: limit,
            orderBy: { frequency_score: 'desc' },
        });
        return fallbackWords.map((w) => buildSimpleDrill(w, mode));
    }

    return words.map((w) => buildSimpleDrill(w, mode));
}

/**
 * 获取待练习词汇
 */
async function fetchWordsForDrill(
    userId: string,
    mode: SessionMode,
    limit: number
) {
    // 1. 优先：复习队列中的词
    const reviewWords = await db.userProgress.findMany({
        where: {
            userId,
            status: { in: ['LEARNING', 'REVIEW'] },
            next_review_at: { lte: new Date() },
        },
        take: limit,
        orderBy: { next_review_at: 'asc' },
        include: { vocab: { include: { etymology: true } } },
    });

    if (reviewWords.length >= limit) {
        return reviewWords.map((r) => r.vocab);
    }

    // 2. 补充：新词
    const existingIds = reviewWords.map((r) => r.vocabId);
    const newWords = await db.vocab.findMany({
        where: {
            id: { notIn: existingIds },
            progress: { none: { userId } },
            OR: [{ is_toeic_core: true }, { abceed_level: { lte: 2 } }],
        },
        take: limit - reviewWords.length,
        orderBy: { frequency_score: 'desc' },
        include: { etymology: true }
    });

    return [...reviewWords.map((r) => r.vocab), ...newWords];
}

import { createPhrasePayload } from './phrase-drill';

/**
 * Vocab 输入接口 (用于 Drill 构建)
 * 定义 buildSimpleDrill 函数所需的词汇字段
 */
export interface VocabDrillInput {
    id: number;
    word: string;
    definition_cn?: string | null;
    commonExample?: string | null;
    collocations?: unknown; // Prisma JsonValue
    definitions?: unknown; // Prisma JsonValue
    phoneticUk?: string | null;
    phoneticUs?: string | null;
    partOfSpeech?: string | null; // [New]
    etymology?: any; // [New]
}

/**
 * 构建单个简单 Drill (统一兜底至 Phrase Mode)
 */
export function buildSimpleDrill(vocab: VocabDrillInput, mode: SessionMode): BriefingPayload {
    // 1. 尝试从 Collocations 获取短语
    let sentence = "";
    let translation = "";

    // Check for collocations
    if (vocab.collocations && Array.isArray(vocab.collocations) && vocab.collocations.length > 0) {
        const candidates = vocab.collocations as any[];
        // Strategy: Find first collocation with translation
        const bestCollo = candidates.find(c => c.text && c.trans);

        if (bestCollo) {
            sentence = bestCollo.text;
            translation = bestCollo.trans;
        } else {
            // Fallback: Use first text-only
            const textOnly = candidates.find(c => c.text);
            if (textOnly) {
                sentence = textOnly.text;
                translation = vocab.definition_cn || "";
            }
        }
    }

    // 2. Fallback to commonExample
    if (!sentence && vocab.commonExample) {
        sentence = vocab.commonExample;
        translation = vocab.definition_cn || "";
    }

    // 3. Last Resort: Construct artificial sentence
    if (!sentence) {
        sentence = `The word "${vocab.word}" means ${vocab.definition_cn || 'something'}.`;
        translation = vocab.definition_cn || "未知";
    }

    // [New] Construct Rich Definition Logic for Explanation
    // Update: createPhrasePayload handles generic info. We just pass what we have.
    // If we want to strictly follow previous rich definition logic, we might need to pass it?
    // createPhrasePayload uses generic `vocab.definition_cn`.
    // Let's stick to generic for unification. Rich Definition logic was mainly for explanation_markdown.
    // The createPhrasePayload logic is: `**${vocab.word}**: ${vocab.definition_cn}\n\n[${vocab.phoneticUs}] ${vocab.partOfSpeech}`
    // If we want to preserve "Rich Definition" (Business v. General), we should ideally pass a processed definition string.
    // But for unification, let's trust the standard definition first.

    return createPhrasePayload(
        {
            id: vocab.id,
            word: vocab.word,
            definition_cn: vocab.definition_cn || '', // Ensure string
            phoneticUs: vocab.phoneticUs ?? vocab.phoneticUk ?? null, // Fallback to UK if US missing, ensure null
            partOfSpeech: vocab.partOfSpeech ?? null // Now supported, ensure null
        },
        sentence,
        translation,
        mode,
        'deterministic_fallback',
        vocab.etymology // [New]
    );
}
