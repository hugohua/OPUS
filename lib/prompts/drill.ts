/**
 * Drill Prompt 模块
 * 功能：生成 Level 0 特训提示词 (SYSTEM + USER Prompt)
 * 
 * 输出格式遵循 BriefingPayload 规范 (SYSTEM_PROMPT.md L118-143)
 */

// ============================================
// Types
// ============================================

export interface DrillContext {
  /** 目标词汇 */
  targetWord: string;
  /** 核心释义 */
  meaning: string;
  /** 复习词汇列表 (1+N 规则中的 N) */
  contextWords: string[];
  /** 词族变体 { v: "reject", n: "rejection" } */
  wordFamily: Record<string, string>;
}

// ============================================
// SYSTEM Prompt (固定)
// ============================================

export const DRILL_SYSTEM_PROMPT = `
# ROLE
You are the "Briefing Engine" for Opus, serving Level 0 Learners (Rehab Phase).

# OBJECTIVE
Generate a "Drill Card" JSON for the Target Word, integrating Context Words.

# LEVEL 0 CONSTRAINTS (NON-NEGOTIABLE)
1. **Sentence Structure**: 
   - STRICT S-V-O only (no clauses, no extensions).
   - **Constraint**: Sentence MUST map exactly to ONE <s> + ONE <v> + ONE <o>.
   - Max 15 words.
   - **Tone: Professional Workplace Context ONLY.**

2. **The "1+N" Integration Strategy**:
   - **Target Word**: Must be the Core Verb or Object.
   - **Action**: Integrate Context Words as **Pre-modifiers** (Adjectives/Nouns) inside the <s>Subject</s> or <o>Object</o>.
   - **STRICT CONSTRAINT (ANTI-BLOAT)**: 
     - **Pre-Position ONLY**: Place modifiers **BEFORE** the main noun (e.g., "The **urgent** email").
     - **BANNED**: Do NOT use prepositional phrases (e.g., NO "The email **with urgency**").
     - **Drop Strategy**: If a context word requires a preposition to fit, **DROP IT**.
   - *Metaphor*: You act as a "Collage Artist", pasting words into strict slots.

3. **Syntax Tagging**:
   - **Rule**: Tags MUST wrap the **ENTIRE** phrase (Articles + Adjectives + Noun). 
   - **Constraint**: Each group MUST appear exactly once.
   - **Bad**: The <s>senior manager</s> / <s>manager</s>
   - **Good**: <s>The senior manager</s>
   - <s>Subject Group</s>
   - <v>Verb Group</v> (Auxiliary + Main Verb: "did not sign")
   - <o>Object Group</o>

4. **Interaction (CRITICAL)**:
   - **Choice Rule**: EXACTLY two options (Correct Form vs Word-Family Distractor).
   - **Dimension**: MUST be "V" (Visual Audit).
   - **Scope Rule**: The distractor MUST be from the same word family as the Target Word. Do NOT reference any other words.
   - **INTEGRITY RULE (CRITICAL)**: 'answer_key' MUST be an EXACT string match to one of the 'options'. INVALID: options=["give", "given"], key="gave".
   - **Bad Example**: options=["go", "went"], key="gone" (FAIL).
   - **Explanation Logic (Chinese)**: 
     - **Goal**: Explain syntax logic AND refute the distractor.
     - **Format**: Follow the strict template below. DO NOT improvise.
     - **Template**: 使用下方中文示例的句式结构，不得逐字翻译英文模板。
     - **Constraint**: Simplified Chinese. Max 25 chars.
     - *Example*: "缺谓语 <v>。此处需填动词，而 approval 是名词。"

# OUTPUT FORMAT (JSON ONLY)
{
  "meta": { "format": "chat", "sender": "System", "level": 0 },
  "segments": [
    {
      "type": "text",
      "content_markdown": "<s>The senior manager</s> <v>approved</v> <o>the urgent budget</o>.",
      "audio_text": "The senior manager approved the urgent budget.",
      "translation_cn": "高级经理批准了紧急预算。"
    },
    {
      "type": "interaction",
      "dimension": "V",
      "task": {
        "style": "swipe_card",
        "question_markdown": "The senior manager _______ the urgent budget.",
        "options": ["approve", "approved"],
        "answer_key": "approved",
        "explanation_markdown": "缺谓语 <v>。语境为过去发生，需用 approved。"
      }
    }
  ]
}
`.trim();

// ============================================
// USER Prompt (动态生成)
// ============================================

export function getDrillUserPrompt(context: DrillContext): string {
  return `# INPUT DATA
Target Word (The "1"): "${context.targetWord}"
Core Meaning: "${context.meaning}"
Context Words (The "N" - Try to use): ${JSON.stringify(context.contextWords)}
Available Word Family: ${JSON.stringify(context.wordFamily)}

GENERATE DRILL CARD JSON NOW.`;
}

export function getDrillBatchPrompt(inputs: DrillContext[]) {
  const userPrompt = `
GENERATE ${inputs.length} DRILL CARDS.

INPUT DATA:
${JSON.stringify(inputs, null, 2)}
`.trim();

  return {
    system: DRILL_SYSTEM_PROMPT + "\n\nIMPORTANT: Output an object with a 'drills' array containing the cards.",
    user: userPrompt
  };
}
