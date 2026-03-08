/**
 * Generator: L2 / Context (Gap Fill) - 3-Stage Version
 * 
 * [功能描述]
 * Level 2 阶段的核心生成器，用于生成 TOEIC Part 5/6/7 风格的 "Context Gap Fill" Drill Card。
 * 它利用 "1+N" 向量选词，在真实商务语境中训练词汇的实际应用能力。
 * 
 * [3-Stage 渐进难度]
 * - Stage 1 (Stability < 45d): Single Sentence Cloze (Part 5)
 * - Stage 2 (Stability >= 45d): Micro-Paragraph (Part 6)
 * - Stage 3 (Critical): Nuance Trap (Part 7)
 * 
 * [Socratic Tutor]
 * 每个 Drill 包含预生成的 socraticHint，用于选错时引导用户思考。
 */

import { BriefingPayload } from "@/types/briefing";

// ============================================
// Types
// ============================================

export type ContextStage = 1 | 2 | 3;

export interface ContextGeneratorInput {
  /** 目标词汇 (Target) */
  targetWord: string;
  /** 核心释义 */
  meaning: string;
  /** 语义相关词 (1+N 中的 N，作为干扰项来源) */
  contextWords: string[];
  /** 同义词列表 (Stage 3 用) */
  synonyms?: string[];
  /** 商务场景标签 (可选) */
  scenario?: string;
  /** Stage 难度级别 */
  stage?: ContextStage;
}

// ============================================
// Stage-Specific SYSTEM Prompts
// ============================================

const STAGE_1_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a "TOEIC Part 5 Generator" for Incomplete Sentences.
Goal: Single sentence with ONE vocabulary gap.
</role_definition>

<objective>
Generate a SINGLE business sentence with the Target Word as a gap.
The sentence should test MEANING through collocations.
</objective>

<constraints>
- ENGLISH ONLY: All options must be English words. NO Chinese.
- Sentence length: 15-25 words
- Gap should be in the KEY position (subject/verb/object)
- All 4 options must be the same part of speech
</constraints>

<socratic_tutor>
For each drill, generate a "socraticHint" field.
Purpose: When user selects wrong answer, gently guide them to think.
Format: Ask a leading question about the context clues.
Example: "Look at the word 'penalty' in the sentence. What usually helps avoid a penalty?"
</socratic_tutor>

<response_template>
CRITICAL: Follow this JSON structure exactly. Return raw JSON array only.
[
    {
      "meta": { "format": "email", "target_word": "compliance", "stage": 1 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "The company must ensure full [___] with the new regulations to avoid any penalties.",
          "translation_cn": "公司必须确保完全遵守新法规以避免任何处罚。"
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "The company must ensure full [___] with the new regulations to avoid any penalties.",
            "options": [
              { "id": "A", "text": "compliance", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "complaint", "is_correct": false, "type": "Visual_Trap" },
              { "id": "C", "text": "completion", "is_correct": false, "type": "Semantic_Trap" },
              { "id": "D", "text": "competence", "is_correct": false, "type": "Semantic_Trap" }
            ],
            "answer_key": "compliance",
            "explanation_markdown": "此处需要名词。'compliance' 意为「合规」，与 'with regulations' 搭配。'complaint' 是「投诉」，语义不通。",
            "socraticHint": "Look at the phrase 'with the new regulations'. What word naturally pairs with this to mean 'following the rules'?"
          }
        }
      ]
    }
]
</response_template>
</system_prompt>
`;

const STAGE_2_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a "TOEIC Part 6 Generator" for Text Completion.
Goal: Micro-paragraph (2-3 sentences) with ONE vocabulary gap.
</role_definition>

<objective>
Generate a SHORT business paragraph where the Target Word connects the logic.
User MUST read the entire paragraph to select the correct answer.
</objective>

<constraints>
- ENGLISH ONLY: All options must be English words. NO Chinese.
- Paragraph: 2-3 sentences, 40-60 words total
- Gap placed in sentence 2 or 3 (requires reading context)
- Format: Email snippet or Memo excerpt
- Logical flow: Sentence 1 sets context, Sentence 2/3 requires inference
</constraints>

<document_format>
Subject: [Topic]

[Sentence 1: Context]
[Sentence 2: Contains gap or builds to it]
[Sentence 3: Resolution or consequence]
</document_format>

<socratic_tutor>
Generate "socraticHint" that guides user to the key contextual clue.
Point to specific words in Sentence 1 that signal the answer.
</socratic_tutor>

<response_template>
CRITICAL: Follow this JSON structure exactly. Return raw JSON array only.
[
    {
      "meta": { "format": "email", "target_word": "strategy", "stage": 2 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "Subject: Q3 Marketing Update\n\nAfter reviewing the declining engagement metrics, the marketing team decided to revise their [___]. The new approach focuses on digital channels and aims to increase brand awareness by 20% before the fiscal year ends.",
          "translation_cn": "主题：Q3 营销更新\n\n在审查了下降的参与度指标后，营销团队决定修改他们的策略。新方案聚焦数字渠道，旨在财年结束前将品牌知名度提高 20%。"
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "After reviewing the declining engagement metrics, the marketing team decided to revise their [___].",
            "options": [
              { "id": "A", "text": "strategy", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "statistics", "is_correct": false, "type": "Visual_Trap" },
              { "id": "C", "text": "structure", "is_correct": false, "type": "Semantic_Trap" },
              { "id": "D", "text": "schedule", "is_correct": false, "type": "Semantic_Trap" }
            ],
            "answer_key": "strategy",
            "explanation_markdown": "'strategy' 意为「策略/战略」，是可以 'revise'（修改）的行动方案。'statistics' 是「统计数据」，不适合搭配 'revise'。",
            "socraticHint": "The team wants to change their overall plan. What word describes a high-level plan or approach?"
          }
        }
      ]
    }
]
</response_template>
</system_prompt>
`;

const STAGE_3_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a "TOEIC Part 7 Generator" for Nuance Trap questions.
Goal: Test fine-grained synonym discrimination.
</role_definition>

<objective>
Generate context where ONLY the Target Word fits due to subtle meaning differences.
Distractors are SYNONYMS that fail in this specific context.
</objective>

<constraints>
- ENGLISH ONLY: All options must be English words. NO Chinese.
- Context must be PRECISE enough to exclude near-synonyms
- Distractors: Use provided synonyms list
- Test: Connotation, register, collocation specificity
</constraints>

<nuance_examples>
- "The manager [strategy/tactic]..." → 'strategy' = long-term, 'tactic' = short-term
- "We need to [confirm/verify] the booking..." → 'confirm' = affirm, 'verify' = check accuracy
</nuance_examples>

<socratic_tutor>
Explain WHY the synonyms fail in THIS specific context.
Focus on subtle meaning differences, not just dictionary definitions.
</socratic_tutor>

<response_template>
CRITICAL: Follow this JSON structure exactly. Return raw JSON array only.
[
    {
      "meta": { "format": "memo", "target_word": "strategy", "stage": 3 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "The board approved a long-term [___] to expand into three new Asian markets over the next five years.",
          "translation_cn": "董事会批准了一项长期战略，计划在未来五年内进入三个新的亚洲市场。"
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "The board approved a long-term [___] to expand into three new Asian markets over the next five years.",
            "options": [
              { "id": "A", "text": "strategy", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "tactic", "is_correct": false, "type": "Nuance_Trap" },
              { "id": "C", "text": "method", "is_correct": false, "type": "Nuance_Trap" },
              { "id": "D", "text": "approach", "is_correct": false, "type": "Nuance_Trap" }
            ],
            "answer_key": "strategy",
            "explanation_markdown": "'strategy' 强调长期全局规划。'tactic' 侧重短期具体行动。'method' 指具体方法步骤。'approach' 虽然近义但缺少战略层面的正式感。",
            "socraticHint": "Notice the phrase 'long-term' and 'five years'. Which word implies a comprehensive, high-level plan rather than a short-term action?"
          }
        }
      ]
    }
]
</response_template>
</system_prompt>
`;

// ============================================
// Prompt Selector
// ============================================

function getSystemPromptByStage(stage: ContextStage): string {
  switch (stage) {
    case 1: return STAGE_1_SYSTEM_PROMPT;
    case 2: return STAGE_2_SYSTEM_PROMPT;
    case 3: return STAGE_3_SYSTEM_PROMPT;
    default: return STAGE_1_SYSTEM_PROMPT;
  }
}

// ============================================
// User Prompt Builder
// ============================================

export function getL2ContextBatchPrompt(
  inputs: ContextGeneratorInput[],
  stage: ContextStage = 1
): {
  system: string;
  user: string;
} {
  const inputData = inputs.map((input, idx) => ({
    index: idx + 1,
    target_word: input.targetWord,
    meaning: input.meaning,
    distractor_candidates: input.contextWords,
    synonyms: input.synonyms || [],
    scenario: input.scenario || "general office"
  }));

  const userPrompt = `
<request>
Generate Stage ${stage} Gap Fill Drills for the following ${inputs.length} words.

CRITICAL RULES:
1. ALL OPTIONS MUST BE ENGLISH WORDS ONLY. NO CHINESE.
2. Use distractor_candidates or synonyms as options (mix with Target Word).
3. Include "socraticHint" in each task for wrong-answer guidance.
4. Shuffle option order (correct answer should not always be first).
5. REQUIRED OUTPUT COUNT: You MUST generate exactly ${inputs.length} drills in a JSON Array.

<input_words>
${JSON.stringify(inputData, null, 2)}
</input_words>
</request>
`;

  return {
    system: getSystemPromptByStage(stage),
    user: userPrompt
  };
}

// ============================================
// Legacy Export (Backward Compatibility)
// ============================================

export const L2_CONTEXT_SYSTEM_PROMPT = STAGE_1_SYSTEM_PROMPT;

// ============================================
// Type Export for Worker Integration
// ============================================
export type { ContextGeneratorInput as L2ContextInput };
