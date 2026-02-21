/**
 * Deterministic Drill 模板引擎
 * 功能：
 *   库存为空时，使用数据库数据构建最小可用 Drill（不依赖 LLM）
 * 原则：
 *   100% 确定性，零延迟
 */
import { db } from '@/lib/db';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { buildPhraseFallbackDrill } from './phrase-fallback';

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
        return fallbackWords.map((w) => buildPhraseFallbackDrill(w, mode));
    }

    return words.map((w) => buildPhraseFallbackDrill(w, mode));
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



/**
 * Vocab 输入接口 (用于 Drill 构建)
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
 * [New] 构建 Chunking 模式的兜底数据
 * 必须返回符合 ChunkingDrillOutput 结构的 payload (强转为 BriefingPayload)
 */
export function buildChunkingDrillFallback(vocab: VocabDrillInput): BriefingPayload {
    const sentence = vocab.commonExample || `The word ${vocab.word} is very important.`;
    const translation = vocab.definition_cn || "这个词非常重要。";

    // Simple naive splitter (Mock logic)
    // Real logic needs NLP, but this is a fallback for testing/offline
    const parts = sentence.split(' ');
    const mid = Math.floor(parts.length / 2);

    // Construct 3 chunks
    const chunks = [
        { id: 1, text: parts.slice(0, 2).join(' '), type: "S" as const },
        { id: 2, text: parts.slice(2, mid).join(' '), type: "V" as const },
        { id: 3, text: parts.slice(mid).join(' '), type: "O" as const }
    ];

    return {
        // Mocking ChunkingDrillOutput structure but casting to BriefingPayload to satisfy TS
        // In runtime, SessionRunner passes this entire object to ChunkingDrill
        target_word: vocab.word,
        full_sentence: sentence,
        translation_cn: translation,
        grammar_point: "Basic Structure",
        complexity_level: "Medium",
        chunks: chunks,
        distractor_chunk: null,
        analysis: {
            skeleton: { subject: "Subject", verb: "Verb", object: "Object" },
            links: [
                { from_chunk_id: 1, to_chunk_id: 2, reason: "主谓一致" },
                { from_chunk_id: 2, to_chunk_id: 3, reason: "动宾搭配" }
            ],
            business_insight: "基础句式结构展示。"
        },
        meta: {
            format: "chat", // Dummy
            mode: "CHUNKING",
            batch_size: 1,
            sys_prompt_version: "v1.0",
            vocabId: vocab.id,
            target_word: vocab.word,
            source: "deterministic_fallback_chunking"
        },
        segments: [] // Dummy to satisfy type, usually ignored by ChunkingDrill
    } as unknown as BriefingPayload;
}

