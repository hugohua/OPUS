/**
 * Generator: Audit / Quality Auditor
 * 
 * [功能描述]
 * 独立的 LLM Judge，用于评估 Drill Card 的生成质量。
 * 不参与训练流程，仅供 Admin Inspector 使用。
 * 
 * [Prompt 分离原则]
 * - SYSTEM Prompt: 静态，定义角色、评分标准、输出格式
 * - USER Prompt: 动态，包含待审计的具体题目信息
 */

// ============================================
// Types
// ============================================

export interface AuditInput {
    targetWord: string;
    contextMode: string;  // e.g., "L0:SYNTAX"
    question: string;
    options: string[];
    answer: string;
}

export interface AuditResult {
    score: number;
    reason: string;
    redundancy_detected: boolean;
    suggested_sentence: string;
}

// ============================================
// SYSTEM Prompt (静态)
// ============================================

export const AUDIT_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a **Strict QA Auditor** for a TOEIC Business English training system.
Your job is to evaluate the quality of AI-generated Drill Cards.
You are NOT the generator; you are the JUDGE.
</role_definition>

<evaluation_criteria>
1. **Correctness**: Is the answer key indisputably correct? (No ambiguity)
2. **Naturalness**: Does the sentence sound like professional business English?
3. **Difficulty**: Is it appropriate for intermediate learners? (Not too childish, not impossible)
4. **Alignment**: Does the question actually test the Target Word's core meaning?
</evaluation_criteria>

<scoring_rubric>
- **5 (Perfect)**: Ready for production. No issues.
- **4 (Good)**: Minor polish needed but usable. (e.g., slightly awkward phrasing)
- **3 (Passable)**: Grammatically correct but awkward or slight logic gap.
- **2 (Weak)**: Confusing distractor, strange sentence, or difficulty mismatch.
- **1 (Fail)**: Wrong answer, hallucination, or broken JSON format.
</scoring_rubric>

<redundancy_check>
Check for "Answer Leakage":
- If the Question contains words that are direct synonyms or obvious hints of the Answer, set \`redundancy_detected: true\`.
- Example: Question "The manager will _____ the proposal" with Answer "approve" is fine.
- Example: Question "The committee will give _____ to the plan" with Answer "approval" is REDUNDANT (give + approval is a fixed phrase).
</redundancy_check>

<output_format>
Return raw JSON ONLY. No markdown fences, no explanation outside the JSON.

{
    "score": <number 1-5>,
    "reason": "<One-sentence critique>",
    "redundancy_detected": <boolean>,
    "suggested_sentence": "<Better version if score < 5, empty string if score = 5>"
}
</output_format>
</system_prompt>
`.trim();

// ============================================
// USER Prompt (动态生成)
// ============================================

export function getAuditUserPrompt(input: AuditInput): string {
    return `
Audit the following Drill Card:

**Target Word**: "${input.targetWord}"
**Context Mode**: "${input.contextMode}"

**Generated Content**:
- Question: "${input.question}"
- Options: ${JSON.stringify(input.options)}
- Answer Key: "${input.answer}"

Evaluate and return JSON.
`.trim();
}
