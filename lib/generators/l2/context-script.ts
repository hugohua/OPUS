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
{
  "drills": [
    {
      "meta": { "format": "email", "target_word": "compliance", "stage": 1 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "To avoid the penalty, we must ensure strict [___] with the new regulations.",
          "audio_text": "To avoid the penalty, we must ensure strict blank with the new regulations."
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "Which word completes the sentence?",
            "options": ["compliance", "alliance", "resistance", "distance"],
            "answer_key": "compliance",
            "explanation_markdown": "## Why 'compliance'?\\n'Compliance with regulations' is the standard collocation for following rules.",
            "socraticHint": "The sentence mentions 'penalty' and 'regulations'. What action typically helps avoid penalties related to rules?"
          }
        }
      ]
    }
  ]
}
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
{
  "drills": [
    {
      "meta": { "format": "email", "target_word": "strategy", "stage": 2 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "Subject: Q3 Marketing Review\\n\\nAfter analyzing last quarter's declining sales in the youth segment, we need to revise our [___] to better engage this demographic. The current approach is no longer effective."
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "Which word best completes the email?",
            "options": ["strategy", "budget", "schedule", "inventory"],
            "answer_key": "strategy",
            "explanation_markdown": "## Why 'strategy'?\\n- 'Revise our strategy to engage' is semantically correct.\\n- Budget relates to money, not engagement approach.\\n- Schedule relates to timing, not marketing approach.",
            "socraticHint": "The email mentions 'declining sales' and 'engage demographic'. What would you revise to change HOW you reach customers?"
          }
        }
      ]
    }
  ]
}
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
{
  "drills": [
    {
      "meta": { "format": "memo", "target_word": "strategy", "stage": 3 },
      "segments": [
        {
          "type": "text",
          "content_markdown": "MEMO: Five-Year Growth Plan\\n\\nThe board has approved a comprehensive [___] to expand into Asian markets over the next five years."
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "slot_machine",
            "question_markdown": "Which word creates the most precise meaning?",
            "options": ["strategy", "tactic", "approach", "method"],
            "answer_key": "strategy",
            "explanation_markdown": "## Nuance Analysis\\n- **strategy**: Long-term, comprehensive plan (matches 'five-year' and 'comprehensive')\\n- **tactic**: Short-term, specific action (❌ wrong scope)\\n- **approach**: General way of doing things (✓ grammatical but lacks precision)\\n- **method**: Specific procedure (❌ too operational)",
            "socraticHint": "Notice the timeframe: 'five-year' and 'comprehensive'. Which word implies that level of long-term, big-picture planning?"
          }
        }
      ]
    }
  ]
}
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
5. REQUIRED OUTPUT COUNT: You MUST generate exactly ${inputs.length} drills in the "drills" array.

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
