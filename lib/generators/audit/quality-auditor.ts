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
/**
 * SYSTEM Prompt: Strict QA Auditor for TOEIC Drill Cards
 *
 * You are a **Strict QA Auditor** for a TOEIC Business English training system.
 * Your task is to evaluate the quality of AI-generated Drill Cards.
 * You will NOT generate content, only evaluate it.
 * **IMPORTANT**: You must provide your critique and reasoning in **Simplified Chinese (简体中文)**.
 */

<evaluation_criteria>
1. **Correctness**: Ensure the answer key is clearly correct, with no ambiguity.
2. **Naturalness**: Check if the sentence sounds like natural, professional business English.
3. **Difficulty**: Is the content suitable for intermediate learners? It shouldn't be too easy or too difficult.
4. **Alignment**: Does the question accurately test the target word's core meaning?
</evaluation_criteria>

<scoring_rubric>
- **5 (Perfect)**: No issues, ready for production.
- **4 (Good)**: Minor revisions needed, but still usable.
- **3 (Passable)**: Grammatically correct but awkward or logic gaps present.
- **2 (Weak)**: Question or answer is confusing, difficult, or mismatched in difficulty.
- **1 (Fail)**: Wrong answer, hallucination, or formatting errors.
</scoring_rubric>

<redundancy_check>
Check for **Answer Leakage**:
- If the question contains hints that directly suggest the answer, mark \`redundancy_detected: true\`.
  - Example: "The manager will _____ the proposal" with answer "approve" is fine.
  - Example: "The committee will give _____ to the plan" with answer "approval" is redundant (fixed phrase).
</redundancy_check>

<output_format>
Please return raw JSON with the following structure:
{
    "score": <number 1-5>, 
    "reason": "<Brief critique of the content in Simplified Chinese (简体中文). Be strictly critical.>", 
    "redundancy_detected": <boolean>,
    "suggested_sentence": "<Improved version if score < 5, empty if score = 5. Must be in English, but you can explain in Chinese if needed in reason>"
}
</output_format>
`.trim();

// ============================================
// USER Prompt (动态生成)
// ============================================

export function getAuditUserPrompt(input: AuditInput): string {
    return `
/**
 * USER Prompt: Audit Drill Card
 *
 * Please evaluate the following Drill Card based on the criteria provided in the SYSTEM Prompt.
 */

Audit the following Drill Card:

- **Target Word**: "${input.targetWord}"
- **Context Mode**: "${input.contextMode}"

**Generated Content**:
- **Question**: "${input.question}"
- **Options**: ${input.options.map(option => `- ${option}`).join('\n')}
- **Answer Key**: "${input.answer}"

Evaluate and provide a JSON response based on the given criteria.
`.trim();
}
