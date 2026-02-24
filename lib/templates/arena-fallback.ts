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
            // 判断是精确匹配还是随机模板（审计标记）
            const isExactMatch = seed.targetAnswer === candidate.word;

            return {
                meta: {
                    format: 'chat',
                    mode: 'ARENA_PART5',
                    batch_size: 1,
                    sys_prompt_version: 'deterministic-v1-part5-seed',
                    vocabId: candidate.id,
                    target_word: candidate.word,
                    source: isExactMatch ? 'deterministic_fallback_seed' : 'deterministic_fallback_random_seed',
                    questionSeedId: seed.id,
                    questionType: seed.questionType,
                    part: seed.part || 5
                },
                segments: [
                    {
                        type: 'text',
                        // 将句子中的 _______ 替换回正确的单词
                        content_markdown: String(seed.sentence).includes('_')
                            ? String(seed.sentence).replace(/_+/g, answerKey)
                            : String(seed.sentence),
                        translation_cn: candidate.definition_cn || '暂无翻译'
                    },
                    {
                        type: 'interaction',
                        dimension: 'C', // Or whatever dimension Part 5 implies
                        task: {
                            style: 'swipe_card',
                            // 确保 question_markdown 一定有挖空
                            question_markdown: String(seed.sentence).includes('_')
                                ? String(seed.sentence)
                                : String(seed.sentence).replace(new RegExp(`\\b${answerKey}\\b`, 'i'), '_______'),
                            options: options.map(o => o.text), // Must map back to string[] or formatted objects
                            answer_key: answerKey,
                            explanation_markdown: seed.rationale ? `${seed.rationale}\n\n**${candidate.word}**: ${candidate.definition_cn || '暂无释义'}` : `**${candidate.word}**: ${candidate.definition_cn || '暂无释义'}`
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

// ============================================
// ARENA_PART6 (长文完形) 独立兜底生成
// ============================================
export async function buildArenaPart6FallbackDrill(
    targetWord: string,
    questionSeedId?: string,
    questionType?: string,
    part?: number
): Promise<BriefingPayload> {
    // 采用稳定版本的 IT 服务维护通知模板作为通用兜底，即使完全断网或 LLM 熔断，前端也有内容展示
    return {
        meta: {
            format: "part6",
            mode: "ARENA_PART6",
            batch_size: 4,
            sys_prompt_version: "static-fallback-v2",
            source: 'static_fallback',
            generation_ms: 0,
            target_word_blank_index: 2,
            target_word: targetWord,
            questionSeedId: questionSeedId,
            questionType: questionType,
            part: part ?? 6,
            seed_origin: part === 6 ? 'part6_native' : 'part5_fallback'
        },
        passage_markdown: "Dear Team,\n\nPlease note that the server maintenance scheduled for tonight has been [__BLANK_1__]. We apologize for any [__BLANK_2__] this may cause. The IT department will [__BLANK_3__] you when the new schedule is confirmed. Thank you for your continued [__BLANK_4__].\n\nBest,\nIT Support",
        segments: [
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { id: '1', text: "postponed", is_correct: true, type: "Correct", explanation_chunk: "此处表示原定计划被'推迟'。" },
                        { id: '2', text: "promoted", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '3', text: "predicted", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '4', text: "prevented", is_correct: false, type: "Distractor", explanation_chunk: "" }
                    ],
                    answer_key: "postponed",
                    explanation_markdown: "此处表示原定计划被'推迟'。"
                }
            },
            {
                type: "interaction",
                dimension: "X",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { id: '5', text: "inconvenience", is_correct: true, type: "Correct", explanation_chunk: "cause后接名词形式，表示'造成不便'。" },
                        { id: '6', text: "inconvenient", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '7', text: "inconveniently", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '8', text: "inconveniences", is_correct: false, type: "Distractor", explanation_chunk: "" }
                    ],
                    answer_key: "inconvenience",
                    explanation_markdown: "cause后接名词形式，表示'造成不便'。"
                }
            },
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { id: '9', text: "notify", is_correct: true, type: "Correct", explanation_chunk: "notify sb. (通知某人) 为固定用法。" },
                        { id: '10', text: "notice", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '11', text: "state", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '12', text: "remark", is_correct: false, type: "Distractor", explanation_chunk: "" }
                    ],
                    answer_key: "notify",
                    explanation_markdown: "notify sb. (通知某人) 为固定用法。"
                }
            },
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { id: '13', text: "cooperation", is_correct: true, type: "Correct", explanation_chunk: "thank you for your cooperation 是标准商务信函结语定式用法。" },
                        { id: '14', text: "collaboration", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '15', text: "coordination", is_correct: false, type: "Distractor", explanation_chunk: "" },
                        { id: '16', text: "contribution", is_correct: false, type: "Distractor", explanation_chunk: "" }
                    ],
                    answer_key: "cooperation",
                    explanation_markdown: "thank you for your cooperation 是标准商务信函结语定式用法。"
                }
            }
        ]
    };
}
