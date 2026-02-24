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
        - REQUIRED: Exactly ONE gap must strictly test the provided \`targetWord\` (or its valid grammatical inflection).
        - The remaining THREE gaps must be generated organically by you. 
        - The mix of the FOUR total questions MUST STRICTLY cover 4 UNIQUE \`dimension\`s from this list if possible, or at least 3:
            - "V" (Vocabulary): Semantic trap. 
            - "M" (Meaning): Sentence insertion or logical connector trap.
            - "X" (Syntax): Word form, tense, relative pronoun trap.
            - "C" (Collocation): Preposition or fixed phrase trap.
        - NO MORE THAN TWO questions can share the same \`dimension\`.
    </blank_distribution_rules>

    <adversarial_distractors_constraints>
        CRITICAL: EVERY option array MUST contain 1 correct answer and 3 HIGHLY DECEPTIVE distractors. 
        - For "M" (Sentence Insertion): 
            1. The CORRECT sentence MUST contain a physical hook (e.g., a pronoun like "It", "These", or a logical adverb like "However", "Therefore") that tightly anchors it to the preceding or following sentence.
            2. DISTRACTORS must NOT be easily dismissed by common sense. They MUST contain vocabulary from the same topic but contain fatal logical flaws (e.g., incorrect timeline, wrong pronoun reference, or conflicting cause-effect).
        - For "V" (Vocabulary): 
            1. Distractors MUST belong to the SAME SEMANTIC FIELD as the correct answer (e.g., if the answer is "verify" inventory, distractors should be "estimate", "produce", "distribute", NOT "apologize").
            2. Distractors MUST grammatically fit the sentence (e.g., be transitive verbs if an object follows) but fail strictly due to subtle business logic mismatch.
        - For "X" (Syntax) & "C" (Collocation): 
            1. Leverage classic TOEIC traps (e.g., preposition 'to' vs infinitive 'to', confusing suffixes, active vs passive voice).
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
  "passage_markdown": "Passage text with exactly four [__BLANK_N__] markers incorporated naturally into the sentences...",
  "target_word_blank_index": 2, // The integer index (1, 2, 3, or 4) indicating which blank represents the target word.
  "interactions": [
    {
      "type": "interaction",
      "dimension": "X", // Must be V, M, X, or C
      "task": {
        "style": "bubble_select",
        "question_markdown": "", // Optional extra context snippet
        "options": [
          { "text": "distractor1", "is_correct": false, "explanation_markdown": "" },
          { "text": "CorrectOption", "is_correct": true, "explanation_markdown": "" },
          { "text": "distractor2", "is_correct": false, "explanation_markdown": "" },
          { "text": "distractor3", "is_correct": false, "explanation_markdown": "" }
        ],
        "answer_key": "CorrectOption",
        "explanation_markdown": "Chinese explanation..."
      }
    },
    // ... MUST have exactly 3 more interactions here, 4 in total!
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
