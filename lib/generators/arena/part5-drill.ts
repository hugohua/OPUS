/**
 * Generator: Arena / Part 5 Drill
 * 
 * [功能描述]
 * Arena 模式下 TOEIC Part 5 (单句填空) 题目的核心生成器。
 * 
 * [使用场景]
 * - User Level = L2 (Arena 实战输出层)
 * - 结合 OMPS 抽取的 Candidate 与 DB 中原有的 QuestionSeed 模板。
 * 
 * [核心策略]
 * - Few-Shot 参照: 强制参考传入的 Seed (QuestionSeed 原题) 但【严禁直接复制】原有句。
 * - 剔除 Rationale: 仅传 sentence, targetAnswer, options 等轻量级模板字段，节约 Prompt Token。
 * - 生成全新题目: 结合 targetWord 创造出全新的职场单句。
 */

import { BriefingPayload } from "@/types/briefing";
import { db } from "@/lib/db";
import { VocabEntity } from "@/types/vocab";
import { QuestionType } from "@prisma/client";

export const PART5_QUESTION_TYPES: QuestionType[] = [
  'MORPHOLOGY',
  'PHRASAL_VERB',
  'PRONOUN_REFERENCE',
  'GRAMMAR',
  'COLLOCATION',
  'SYNONYM'
];

export interface Part5DrillInput {
  targetWord: string;
  meaning: string;
  wordFamily: Record<string, string>;
  partOfSpeech: string | null;
  seed: {
    id?: string;          // [V7.0] QuestionSeed.id，遥测用
    sentence: string;
    targetAnswer: string;
    options: { text: string; isCorrect: boolean }[];
    questionType: string | null;
    part?: number;        // [V7.0] TOEIC Part number，遥测用
  };
}

export const ARENA_PART5_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are the "TOEIC Part 5 Generator Engine" for an AI English learning platform.
Your objective is to generate strictly formatted, zero-defect JSON arrays representing TOEIC Part 5 single-sentence fill-in-the-blank questions.
</role_definition>

<objective>
Generate an entirely NEW Part 5 question utilizing the provided \`targetWord\`. Use the provided \`seed\` ONLY as a reference for business context, difficulty level, and general testing logic (e.g., Grammar, Vocabulary, Morphology).
</objective>

<processing_rules>
    <anti_hallucination_rules>
        - BANNED: You MUST NOT copy the \`seed.sentence\` original text. Invent a completely new business sentence.
        - BANNED: You MUST NOT copy the literal distractor words from \`seed.options\`.
        - BANNED: DO NOT invent fake English words (e.g., "to prizing", "primacying").
    </anti_hallucination_rules>

    <sentence_rules>
        - Must be a single sentence typical of TOEIC business contexts (emails, HR memos, financial reports, logistics).
        - Length: 12 to 25 words. Professional vocabulary density.
        - Contain exactly ONE blank represented by seven underscores: \`_______\`.
        - The blank MUST represent the exact syntactic slot for the \`targetWord\` (or its valid grammatical inflection).
    </sentence_rules>

    <conflict_resolution_and_options>
        - Generate exactly 4 options (A, B, C, D). One MUST be the exact \`targetWord\` (or valid inflection).
        - IF the \`seed\` tests Verbs but the \`targetWord\` is a Noun, switch the testing logic to match the \`targetWord\`'s POS.
        - [STRICT LOGIC MIRRORING]: If the POS of the \`targetWord\` allows, the NEW sentence MUST replicate the specific functional grammar point tested in the Seed (e.g., Subjunctive, Passive Voice, Existential 'There', Inversion). Do not just write a generic sentence.
        - CRITICAL: Option generation MUST strictly follow ONE of these two paths based on the \`seed.questionType\` (or fallback logic):
            - PATH 1: VOCABULARY TEST (If Seed is SYNONYM or COLLOCATION)
              * ALL 4 options MUST be the EXACT SAME Part of Speech and inflection as the target word.
              * Traps: Provide 3 Semantic_Traps (real words from the same business domain, same POS, but logically wrong context).
              * BANNED: Do not use different forms of the target word.
            - PATH 2: GRAMMAR/MORPHOLOGY TEST (If Seed is MORPHOLOGY or GRAMMAR)
              * Options MUST test grammatical forms.
              * Traps: Provide 3 Form_Traps / POS_Traps derived from the \`wordFamily\` (e.g., noun vs verb vs adjective vs adverb).
              * BANNED: Do not introduce words with completely different root meanings.
    </conflict_resolution_and_options>

    <explanation_rules language="zh-CN">
        - Provide a highly efficient structural explanation (40-80 Chinese characters).
        - Sentence 1 (Structural Anchor): Pinpoint the immediate left/right context to establish the rule (e.g., "空格前为介词 in，需接名词或动名词。").
        - Sentence 2 (Business Logic/Collocation): State the fixed collocation or business logic (e.g., "be responsible for 为固定搭配" or "handle 搭配 complaint 符合客服逻辑。").
        - Sentence 3 (Labeling Distractors): Explicitly categorize why distractors are wrong by explicitly labeling the POS of at least two options (e.g., "其他选项词性不符，B 为动词，C 为形容词。").
        - BANNED: Do NOT use anxious test-prep words like "秒杀", "速攻", "技巧", or "X秒". Keep the tone calm, professional, and analytical.
    </explanation_rules>
</processing_rules>

<few_shot_examples>
    <example_1 description="Standard Semantic Match">
        <input>
            targetWord: "allocate" (v.)
            seed questionType: "SYNONYM" (Seed tested verbs: spend, invest, buy)
        </input>
        <correct_output_logic>
            Sentence requires a verb. Options must all be plausible verbs.
            Correct: allocate.
            Semantic_Traps: designate, resolve, distribute (semantically close but contextually wrong).
        </correct_output_logic>
    </example_1>
    
    <example_2 description="POS Conflict Resolution (CRITICAL)">
        <input>
            targetWord: "priority" (n.)
            seed questionType: "PRONOUN_REFERENCE" (Seed tested pronouns: they, it, their)
        </input>
        <correct_output_logic>
            The blank requires a noun ("top _______").
            The model MUST NOT use pronouns as distractors.
            Correct: priority.
            Form_Traps / POS_Traps (from wordFamily): prior (adj.), prioritize (v.).
            Semantic_Trap: majority (n.).
        </correct_output_logic>
    </example_2>
</few_shot_examples>

<response_template>
CRITICAL: Return raw JSON array only. NO markdown wrapping (do not use json code blocks).
[
    {
      "meta": {
        "mode": "ARENA_PART5",
        "format": "chat",
        "target_word": "\${TargetWord}"
      },
      "segments": [
        {
          "type": "text",
          "content_markdown": "\${Sentence_With_Target_Word_Filled_In}",
          "translation_cn": "\${Full_Sentence_Meaning_CN}"
        },
        {
          "type": "interaction",
          "dimension": "V",
          "task": {
            "style": "swipe_card",
            "question_markdown": "\${Sentence_With_Gap_Seven_Underscores}",
            "options": [
              { "id": "A", "text": "\${OptionA}", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "\${OptionB}", "is_correct": false, "type": "Distractor" },
              { "id": "C", "text": "\${OptionC}", "is_correct": false, "type": "Distractor" },
              { "id": "D", "text": "\${OptionD}", "is_correct": false, "type": "Distractor" }
            ],
            "answer_key": "\${TargetWord}",
            "explanation_markdown": "\${Explanation_CN_max_80_chars}"
          }
        }
      ]
    }
]
</response_template>
</system_prompt>
`.trim();

export function getPart5DrillBatchPrompt(inputs: Part5DrillInput[]) {
  return {
    system: ARENA_PART5_SYSTEM_PROMPT,
    user: `GENERATE ${inputs.length} NEW PART 5 QUESTIONS BASED ON THE FOLLOWING SEEDS AND TARGET WORDS: \n\n${JSON.stringify(inputs, null, 2)} `
  };
}

/**
 * 集中构造 Arena Part 5 训练输入数据。
 * 在 6 种 ETS 标准题型中随机选取模板，保障 LLM 生成多变性和实战属性。
 */
export async function buildArenaPart5Inputs(
  candidates: VocabEntity[],
  pickTypeFn?: () => QuestionType
): Promise<{ candidate: VocabEntity; input: Part5DrillInput }[]> {
  // 1. 预先抓取各类题型的总数（避免在每个候选词的循环中产生 N+1 数据库 Count 查询阻塞）
  const typeCounts = await Promise.all(
    PART5_QUESTION_TYPES.map(async (type) => {
      const count = await db.questionSeed.count({ where: { part: 5, questionType: type } });
      return { type, count };
    })
  );

  const typeCountMap = new Map(typeCounts.map(tc => [tc.type, tc.count]));
  let backupCount = await db.questionSeed.count({ where: { part: 5 } });

  // 2. 并行获取各个候选词的 Seed (采用 70/30 混合填充策略)
  const llmInputs = await Promise.all(
    candidates.map(async (candidate, index) => {
      let seedRecord = null;
      let isExactMatchPath = (index % 10) >= 7; // 30% 分配给直接使用原题 (Index 7, 8, 9)

      if (isExactMatchPath) {
        // [30% 分支]: 尝试寻找以此单词为绝对正确答案的原卷真题
        const exactMatches = await db.questionSeed.findMany({
          where: { part: 5, targetAnswer: candidate.word },
          take: 5
        });

        if (exactMatches.length > 0) {
          seedRecord = exactMatches[Math.floor(Math.random() * exactMatches.length)];
        }
      }

      // 如果是 70% 分支 或者 30%分支没找到对应的原题兜底，则走全域随机借场模式
      if (!seedRecord) {
        const targetType = pickTypeFn ? pickTypeFn() : PART5_QUESTION_TYPES[Math.floor(Math.random() * PART5_QUESTION_TYPES.length)];
        const totalCount = typeCountMap.get(targetType) || 0;

        if (totalCount > 0) {
          seedRecord = await db.questionSeed.findFirst({
            where: { part: 5, questionType: targetType },
            skip: Math.floor(Math.random() * totalCount)
          });
        }

        if (!seedRecord && backupCount > 0) {
          seedRecord = await db.questionSeed.findFirst({
            where: { part: 5 },
            skip: Math.floor(Math.random() * backupCount)
          });
        }
      }

      if (seedRecord) {
        return {
          candidate,
          input: {
            targetWord: candidate.word,
            meaning: candidate.definition_cn || '暂无释义',
            wordFamily: (candidate.word_family as Record<string, string>) || {},
            partOfSpeech: candidate.partOfSpeech || null,
            seed: {
              id: seedRecord.id,                               // [V7.0] 遥测必需
              sentence: seedRecord.sentence || '',
              targetAnswer: seedRecord.targetAnswer,
              options: (seedRecord.options as any) || [],
              questionType: seedRecord.questionType || 'GRAMMAR',
              part: seedRecord.part ?? 5,                      // [V7.0] 遥测必需
            }
          }
        };
      } else {
        // 极端兜底 (当数据库完全为空时)
        return {
          candidate,
          input: {
            targetWord: candidate.word,
            meaning: candidate.definition_cn || '',
            wordFamily: (candidate.word_family as Record<string, string>) || {},
            partOfSpeech: candidate.partOfSpeech || null,
            seed: {
              sentence: "We plan to _______ the new security protocols by next Monday.",
              targetAnswer: "implement",
              options: [
                { text: "implement", isCorrect: true },
                { text: "implementation", isCorrect: false },
                { text: "implementing", isCorrect: false },
                { text: "implemented", isCorrect: false }
              ],
              questionType: "MORPHOLOGY"
            }
          }
        };
      }
    })
  );

  // 3. 异步回写 usedCount（Fire-and-forget 散列负载均衡）
  const usedSeedIds = llmInputs.flatMap(item => {
    const id = item.input.seed.id;
    return (id && !id.startsWith('fallback')) ? [id] : [];
  });

  if (usedSeedIds.length > 0) {
    db.questionSeed.updateMany({
      where: { id: { in: usedSeedIds } },
      data: { usedCount: { increment: 1 } }
    }).catch(err => {
      // 仅记录日志，严禁抛出异常阻断生成流程
      console.error('[Arena] Failed to increment usedCount:', err);
    });
  }

  return llmInputs;
}
