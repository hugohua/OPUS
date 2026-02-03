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
        include: { vocab: true },
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
    });

    return [...reviewWords.map((r) => r.vocab), ...newWords];
}

/**
 * Vocab 输入接口 (用于 Drill 构建)
 * 定义 buildSimpleDrill 函数所需的词汇字段
 * 注意：collocations/definitions 使用 unknown 以兼容 Prisma JsonValue
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
}

/**
 * 构建单个简单 Drill
 */
export function buildSimpleDrill(vocab: VocabDrillInput, mode: SessionMode): BriefingPayload {
    // 1. 尝试从 Collocations 获取短语 (Phrase Mode 优先)
    let sentence = vocab.commonExample;
    let translation = vocab.definition_cn;

    // Check for collocations
    if (vocab.collocations && Array.isArray(vocab.collocations) && vocab.collocations.length > 0) {
        // Strategy: Find the first collocation that has BOTH text and translation
        const candidates = vocab.collocations as any[];
        const bestCollo = candidates.find(c => c.text && c.trans);

        if (bestCollo) {
            sentence = bestCollo.text;
            translation = bestCollo.trans;
        } else {
            // Fallback: Use the first one with text, even if no translation (better than nothing for Phrase mode)
            const textOnly = candidates.find(c => c.text);
            if (textOnly) {
                sentence = textOnly.text;
                // translation remains vocab.definition_cn
            }
        }
    }

    // [New] Construct Rich Definition Logic
    // If definitions object exists, try to combine business_cn and general_cn
    let richDefinition = vocab.definition_cn; // Default to simple definition

    if (vocab.definitions && typeof vocab.definitions === 'object') {
        const defs = vocab.definitions as any;
        const parts = [];
        if (defs.business_cn) parts.push(defs.business_cn);
        if (defs.general_cn && defs.general_cn !== defs.business_cn) parts.push(defs.general_cn);

        if (parts.length > 0) {
            richDefinition = parts.join('; ');
        }
    }

    // Fallback if no sentence found
    if (!sentence) {
        sentence = `The word "${vocab.word}" means ${vocab.definition_cn || 'unknown'}.`;
    }

    return {
        meta: {
            format: 'chat',
            mode: mode,
            batch_size: 1,
            sys_prompt_version: 'deterministic-v1',
            vocabId: vocab.id,
            target_word: vocab.word,
        },
        segments: [
            {
                type: 'text',
                content_markdown: sentence,
                audio_text: sentence,
                translation_cn: translation ?? undefined, // Keeps sentence translation (e.g., "补充食物供应")
                phonetic: vocab.phoneticUk ?? vocab.phoneticUs ?? undefined, // [New] Prefer UK, fallback to US
            },
            {
                type: 'interaction',
                dimension: 'V',
                task: {
                    style: 'swipe_card',
                    question_markdown: `**${vocab.word}** 的意思是？`,
                    options: [vocab.definition_cn || '我认识', '我不认识'],
                    answer_key: richDefinition || '我认识',
                    explanation_markdown: `**${vocab.word}**\n\n${richDefinition || '暂无释义'}`,
                    explanation: {
                        definition_cn: richDefinition || '暂无释义', // Uses rich definition (e.g., "补充; 重新装满")
                    },
                },
            },
        ],
    };
}
