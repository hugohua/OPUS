import { db as prisma } from '@/lib/db';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { VocabDrillInput } from './deterministic-drill';
import { buildPhraseFallbackDrill, extractSentenceForFallback } from './phrase-fallback';

/**
 * ARENA 竞技场模式兜底生成器 (Fallback Generator)
 * 
 * 功能：
 *   当库存耗尽且实时 LLM 生成失败/超时时，使用数据库缓存的优质原题 (QuestionSeed) 
 *   直接构建兜底的交互卡片内容。
 *   支持根据不同的 Arena Module (Part 5, Part 6 等) 分组输出不同结构的伪造卡片。
 */
export function buildArenaFallbackDrill(
    candidate: VocabDrillInput,
    mode: SessionMode,
    seed?: any
): BriefingPayload {

    // ============================================
    // ARENA_PART5 (单句填空题) 兜底逻辑
    // ============================================
    if (mode === 'ARENA_PART5') {
        if (seed) {
            const options = seed.options as { text: string; isCorrect: boolean }[];
            const answerKey = options.find(o => o.isCorrect)?.text || seed.targetAnswer;

            return {
                meta: {
                    format: 'chat',
                    mode: 'ARENA_PART5',
                    batch_size: 1,
                    sys_prompt_version: 'deterministic-v1-part5-seed',
                    vocabId: candidate.id,
                    target_word: candidate.word,
                    source: 'deterministic_fallback_seed'
                },
                segments: [
                    {
                        type: 'text',
                        content_markdown: seed.sentence,
                        translation_cn: candidate.definition_cn || '暂无翻译'
                    },
                    {
                        type: 'interaction',
                        dimension: 'C', // Or whatever dimension Part 5 implies
                        task: {
                            style: 'swipe_card',
                            question_markdown: seed.sentence,
                            options: options.map(o => o.text), // Must map back to string[] or formatted objects
                            answer_key: answerKey,
                            explanation_markdown: `**${candidate.word}**: ${candidate.definition_cn || '暂无释义'}`
                        }
                    }
                ]
            };
        }
    }

    // ============================================
    // 未来可扩展：ARENA_PART6 等逻辑
    // if (mode === 'ARENA_PART6') { ... }
    // ============================================

    // ============================================
    // 终极兜底 (Extreme Fallback)：
    // ============================================

    // 1. 如果是 ARENA_PART5 实在找不到题，退化为仅通过单词加上变形来硬凑出 4 选项
    if (mode === 'ARENA_PART5') {
        const { sentence, translation } = extractSentenceForFallback(candidate);
        // 优化正则：增加词边界 \b 防止 `development` 里的 `develop` 被误替换成 _______ment
        const questionMarkdown = sentence.replace(new RegExp(`\\b${candidate.word}\\b`, 'gi'), '_______');
        return {
            meta: {
                format: 'chat',
                mode: 'ARENA_PART5',
                batch_size: 1,
                sys_prompt_version: 'deterministic-v1-part5',
                vocabId: candidate.id,
                target_word: candidate.word,
                source: 'deterministic_fallback'
            },
            segments: [
                {
                    type: 'text',
                    content_markdown: questionMarkdown,
                    translation_cn: translation
                },
                {
                    type: 'interaction',
                    dimension: 'C',
                    task: {
                        style: 'swipe_card',
                        question_markdown: questionMarkdown,
                        options: [
                            { text: candidate.word, isCorrect: true },
                            { text: candidate.word + 's', isCorrect: false },
                            { text: candidate.word + 'ing', isCorrect: false },
                            { text: candidate.word + 'ed', isCorrect: false }
                        ],
                        answer_key: candidate.word,
                        explanation_markdown: `**${candidate.word}**: ${candidate.definition_cn || '暂无释义'}`
                    }
                }
            ]
        };
    }

    // 2. 如果不属于专属卡片格式，最终都退化为 PHRASE 记忆卡
    return buildPhraseFallbackDrill(candidate, mode);
}
