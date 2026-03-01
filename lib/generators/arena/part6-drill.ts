/**
 * Generator: Arena / Part 6 Drill
 * 
 * [功能描述]
 * Arena 模式下 TOEIC Part 6 (长文多空阅读) 题目的核心生成器。
 * 
 * [使用场景]
 * - 结合 OMPS 抽取到的 1 个核心备考词 (Target Word) 及其对应的 1个 QuestionSeed 模板。
 * - LLM 负责将这个考点融入一篇 110-140 词的连贯职场长文。
 * 
 * [核心策略]
 * - One-Word Driven: 文章包含 4 个 `[__BLANK_N__]`，其中 1 个测试核心词，另外 3 个要求大模型自带考点。
 * - Seed Fallback: 优先尝试从 DB 获取原生的 part: 6 种子。如果缺失，降级借用 part: 6 的单句种子获取灵感。
 * 
 * [调试指引]
 *  纯预演 (不消耗 API 额度，仅生成完整 Prompt 供评估):
 *  npx tsx scripts/debug-prompt.ts -g arena-part6 -n 5
 * 
 *  真机调测 (真实调用 AI 生成长文结果并输出为 txt 文件):
 *  npx tsx scripts/debug-prompt.ts -g arena-part6 -n 2 --run
 */

import { db } from "@/lib/db";
import { OMPSCandidate } from "@/lib/services/omps-core";
import { QuestionType } from "@prisma/client";

export const PART6_QUESTION_TYPES: QuestionType[] = [
    'MORPHOLOGY',
    'GRAMMAR',
    'COLLOCATION',
    'SYNONYM' // In Part 6, context is rich enough for advanced semantic trapping
];

export interface Part6DrillInput {
    targetWord: string;
    meaning: string;
    wordFamily: Record<string, string>;
    partOfSpeech: string | null;
    seed: {
        id?: string;
        passageContent?: string; // Part 6 原文参考
        sentence?: string; // 空白所在的句子
        targetAnswer: string;
        options: { text: string; isCorrect: boolean }[];
        questionType: string | null;
        part: number; // 统一为 6
    };
}

export const ARENA_PART6_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are the "TOEIC Part 6 Advanced Generator Engine" for an adaptive English learning platform.
Your objective is to generate strictly formatted JSON objects representing TOEIC Part 6 text completion passages (1 passage with exactly 4 distinct blanks).
Your hallmark is creating HIGHLY DECEPTIVE, ETS-standard distractors. You do not generate easy or obvious wrong answers.
</role_definition>

<objective>
Generate an entirely NEW Part 6 business passage (110-140 words) utilizing the provided \`targetWord\` as ONE of the blanks. 
The passage MUST contain exactly 4 blanks in total.
Use the provided \`seed\` ONLY as a reference for the primary test point logic. You MUST adapt everything into a cohesive paragraph.
If the \`seed\` contains \`passageContent\`, you can use its topic or style as inspiration, but NEVER copy original sentences.
</objective>

<processing_rules>
    <anti_hallucination_rules>
        - NEVER copy original sentences from the \`seed\`. Invent a fresh scenario.
        - DO NOT invent fake English words.
    </anti_hallucination_rules>

    <passage_rules>
        - Write ONE cohesive business text (e.g., Email, Internal Memo, Notice, Advertisement, or Article).
        - Length: 110-140 words. Professional TOEIC vocabulary density.
        - The passage MUST establish a clear context and logical flow between sentences. Do not write segmented, unrelated sentences.
        - The passage MUST contain EXACTLY four blanks, sequentially marked as \`[__BLANK_1__]\`, \`[__BLANK_2__]\`, \`[__BLANK_3__]\`, and \`[__BLANK_4__]\`.
    </passage_rules>

    <blank_distribution_rules>
        CRITICAL: The 4 blanks MUST follow this STRICT option-type distribution (reflecting real TOEIC Part 6 design):

        | Slot | option_level   | dimension | What is tested                        | Option example                                                |
        |------|----------------|-----------|---------------------------------------|---------------------------------------------------------------|
        | 1 of 4 | "sentence"   | "M"       | Sentence Insertion (logical cohesion) | "We hope you will consider joining us for this event."        |
        | 1 of 4 | "phrase"     | "C" or "X"| Discourse connector / transition phrase | "In addition" / "On the contrary" / "As a result"          |
        | 2 of 4 | "word"       | "V" or "X"| Vocabulary / Grammar / Morphology     | "eligible" / "determined" / "announcing"                     |

        - Exactly ONE blank must have \`option_level: "sentence"\` and \`dimension: "M"\`. Each of its 4 options must be a COMPLETE SENTENCE (9+ words).
        - Exactly ONE blank must have \`option_level: "phrase"\` and \`dimension: "C"\` or \`"X"\`. Each of its 4 options must be a SHORT PHRASE or CONNECTOR (2-6 words, e.g., "In addition", "As a result", "On the other hand").
        - Exactly TWO blanks must have \`option_level: "word"\` and \`dimension: "V"\` or \`"X"\`. Each of its 4 options must be a SINGLE WORD or TWO-WORD form (e.g., "eligible", "to come", "cleanliness").
        - REQUIRED: Exactly ONE of the 4 blanks must strictly test the provided \`targetWord\` (or its valid grammatical inflection).
        - The order of sentence/phrase/word blanks within the passage should feel NATURAL. Typically the sentence insertion blank appears in the MIDDLE or NEAR THE END of the passage.
    </blank_distribution_rules>

    <adversarial_distractors_constraints>
        CRITICAL: EVERY option array MUST contain 1 correct answer and 3 HIGHLY DECEPTIVE distractors. 

        - For "M" (Sentence Insertion / option_level: "sentence"): 
            1. The CORRECT sentence MUST contain a physical hook (e.g., a pronoun like "It", "These", or a logical adverb like "However", "Therefore") that tightly anchors it to the preceding or following sentence.
            2. DISTRACTORS must also be COMPLETE SENTENCES that sound plausible in a business context but contain fatal logical flaws (e.g., incorrect timeline, wrong pronoun reference, conflicting cause-effect, or topic drift).
            3. All 4 option sentences MUST be roughly equal in length (8-18 words each) to prevent length-based guessing.

        - For "C"/"X" (Phrase / Connector / option_level: "phrase"):
            1. All 4 options must be discourse connectors or transition phrases of similar length.
            2. Each distractor must be a REAL English connector that is grammatically valid in isolation but creates a LOGICAL contradiction in context (e.g., using "However" when the context requires addition, not contrast).

        - For "V" (Vocabulary / option_level: "word"): 
            1. Distractors MUST belong to the SAME SEMANTIC FIELD as the correct answer.
            2. Distractors MUST grammatically fit the sentence but fail due to subtle business logic mismatch.

        - For "X" (Syntax / Grammar / option_level: "word"): 
            1. Leverage classic TOEIC traps (e.g., preposition 'to' vs infinitive 'to', confusing suffixes like -tion/-ment/-ness, active vs passive voice).
    </adversarial_distractors_constraints>

    <explanation_rules language="zh-CN">
        - Provide a highly efficient explanation for EACH blank (40-80 Chinese characters).
        - Sentence 1: Pinpoint the structural/contextual anchor.
        - Sentence 2: State the business logic or grammatical necessity.
        - Sentence 3: Briefly label why distractors are wrong (e.g., "A为动词原形，前后文需要名词。").
        - NO anxious test-prep words ("秒杀", "速攻"). Keep the tone analytical.
    </explanation_rules>
</processing_rules>

<response_template>
CRITICAL: You must return a RAW JSON object matching the exact structure below. NO markdown code blocks. NO surrounding text.

{
  "passage_markdown": "Dear Valued Customers, ... [__BLANK_1__] ... [__BLANK_2__] ... [__BLANK_3__] ... [__BLANK_4__] ...",
  "target_word_blank_index": 2,
  "interactions": [
    {
      "type": "interaction",
      "dimension": "X",
      "option_level": "word",
      "task": {
        "style": "bubble_select",
        "question_markdown": "",
        "options": [
          { "text": "determining", "is_correct": false, "explanation_markdown": "" },
          { "text": "determined", "is_correct": true, "explanation_markdown": "" },
          { "text": "determines", "is_correct": false, "explanation_markdown": "" },
          { "text": "determinedly", "is_correct": false, "explanation_markdown": "" }
        ],
        "answer_key": "determined",
        "explanation_markdown": "空格前为 be 动词 was，需要过去分词构成被动语态。A为现在分词，C为第三人称单数，D为副词，均不符合。"
      }
    },
    {
      "type": "interaction",
      "dimension": "V",
      "option_level": "word",
      "task": {
        "style": "bubble_select",
        "question_markdown": "",
        "options": [
          { "text": "eligible", "is_correct": true, "explanation_markdown": "" },
          { "text": "capable", "is_correct": false, "explanation_markdown": "" },
          { "text": "responsible", "is_correct": false, "explanation_markdown": "" },
          { "text": "available", "is_correct": false, "explanation_markdown": "" }
        ],
        "answer_key": "eligible",
        "explanation_markdown": "上下文为资格审查场景，eligible for 为固定搭配，意为"有资格的"。capable 搭配 of，responsible 搭配 for 但语义为负责，available 语义不符。"
      }
    },
    {
      "type": "interaction",
      "dimension": "C",
      "option_level": "phrase",
      "task": {
        "style": "bubble_select",
        "question_markdown": "",
        "options": [
          { "text": "In addition", "is_correct": true, "explanation_markdown": "" },
          { "text": "On the contrary", "is_correct": false, "explanation_markdown": "" },
          { "text": "As a result", "is_correct": false, "explanation_markdown": "" },
          { "text": "For example", "is_correct": false, "explanation_markdown": "" }
        ],
        "answer_key": "In addition",
        "explanation_markdown": "前后两句为递进关系，补充额外信息。On the contrary 表转折，As a result 表因果，For example 表举例，均与语境逻辑不符。"
      }
    },
    {
      "type": "interaction",
      "dimension": "M",
      "option_level": "sentence",
      "task": {
        "style": "bubble_select",
        "question_markdown": "",
        "options": [
          { "text": "We hope you will consider joining us for this event.", "is_correct": false, "explanation_markdown": "" },
          { "text": "Please do not hesitate to contact us if you have any questions.", "is_correct": true, "explanation_markdown": "" },
          { "text": "The new policy will take effect starting next quarter.", "is_correct": false, "explanation_markdown": "" },
          { "text": "All employees are required to attend the training session.", "is_correct": false, "explanation_markdown": "" }
        ],
        "answer_key": "Please do not hesitate to contact us if you have any questions.",
        "explanation_markdown": "此处为邮件结尾的礼貌收束语，前文已完成信息传达，需要结语呼应。A为活动邀请语，与上下文主题不符。C引入新政策话题，偏离主线。D为强制要求，语域过于正式且与前文逻辑断裂。"
      }
    }
  ]
}
</response_template>
</system_prompt>
`.trim();

export function getPart6DrillBatchPrompt(input: Part6DrillInput) {
    return {
        system: ARENA_PART6_SYSTEM_PROMPT,
        user: `GENERATE A NEW PART 6 PASSAGE FOCUSING ON THIS TARGET WORD AND REFERENCE SEED: \n\n${JSON.stringify(input, null, 2)}`
    };
}

/**
 * 构造 Arena Part 6 训练输入数据。
 * [策略]: 由于 Part 6 我们仅依赖 1 个核心词（Target Word），
 * 故不需要如 Part 5 那样并行批量构造，只需要拉取唯一的种子。
 */
export async function buildArenaPart6Input(
    candidate: OMPSCandidate,
    weakGrammarNodeIds?: string[]
): Promise<Part6DrillInput> {
    let seedRecord = null;
    let targetType = PART6_QUESTION_TYPES[Math.floor(Math.random() * PART6_QUESTION_TYPES.length)];

    // 1. [优先分流] 尝试寻找以此单词为绝对正确答案的原卷 Part 6 真题
    const part6ExactMatches = await db.questionSeed.findMany({
        where: { part: 6, targetAnswer: candidate.word },
        include: { passage: true },
        take: 5
    });

    if (part6ExactMatches.length > 0) {
        seedRecord = part6ExactMatches[Math.floor(Math.random() * part6ExactMatches.length)];
    }

    // 2. 如果没有命中 Part 6 专属种子，降维借用 Part 6 的其他单句种子作为灵感锚点
    if (!seedRecord) {
        // 2.1 尝试弱点追踪漏斗
        if ((targetType === 'GRAMMAR' || targetType === 'MORPHOLOGY') && weakGrammarNodeIds && weakGrammarNodeIds.length > 0) {
            const targetedNodeId = weakGrammarNodeIds[Math.floor(Math.random() * weakGrammarNodeIds.length)];

            // 注意：仅借用 part 6
            const targetedSeeds = await db.questionSeed.findMany({
                where: {
                    part: 6,
                    questionType: targetType,
                    grammarNodeId: targetedNodeId
                },
                include: { passage: true },
                take: 10,
                orderBy: { usedCount: 'asc' }
            });

            if (targetedSeeds.length > 0) {
                seedRecord = targetedSeeds[Math.floor(Math.random() * targetedSeeds.length)];
            }
        }

        // 2.2 弱点没命中，从大盘里随便摇一个 Part 6
        if (!seedRecord) {
            const backupSeeds = await db.questionSeed.findMany({
                where: {
                    questionType: targetType,
                    part: 6
                },
                include: { passage: true },
                take: 20
            });

            if (backupSeeds.length > 0) {
                seedRecord = backupSeeds[Math.floor(Math.random() * backupSeeds.length)];
            }
        }
    }

    // 构建返回载荷
    if (seedRecord) {
        // 记录使用 (异步防阻塞)
        db.questionSeed.update({
            where: { id: seedRecord.id },
            data: { usedCount: { increment: 1 } }
        }).catch(err => console.error('[Arena/Part6] Failed to increment usedCount:', err));

        return {
            targetWord: candidate.word,
            meaning: candidate.definition_cn || '暂无释义',
            wordFamily: (candidate.word_family as Record<string, string>) || {},
            partOfSpeech: candidate.partOfSpeech || null,
            seed: {
                id: seedRecord.id,
                passageContent: (seedRecord as any).passage?.content || undefined,
                sentence: seedRecord.sentence || '',
                targetAnswer: seedRecord.targetAnswer,
                options: (seedRecord.options as any) || [],
                questionType: seedRecord.questionType || targetType,
                part: seedRecord.part ?? 6,
            }
        };
    } else {
        // 极端兜底
        return {
            targetWord: candidate.word,
            meaning: candidate.definition_cn || '',
            wordFamily: (candidate.word_family as Record<string, string>) || {},
            partOfSpeech: candidate.partOfSpeech || null,
            seed: {
                sentence: "The management committee decided to _______ the launch date.",
                targetAnswer: candidate.word,
                options: [
                    { text: candidate.word, isCorrect: true },
                    { text: "distractor1", isCorrect: false },
                    { text: "distractor2", isCorrect: false },
                    { text: "distractor3", isCorrect: false },
                ],
                questionType: targetType,
                part: 5
            }
        };
    }
}
