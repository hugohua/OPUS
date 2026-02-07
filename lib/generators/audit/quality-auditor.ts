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

import { z } from 'zod';

export interface AuditInput {
    targetWord: string;
    contextMode: string;  // e.g., "L0:SYNTAX"
    question: string;
    options: string[];
    answer: string;
}

export const AuditResultSchema = z.object({
    score: z.number().min(1).max(5),
    error_type: z.enum(['NONE', 'AMBIGUITY', 'UNNATURAL', 'LEAKAGE', 'BAD_DISTRACTORS', 'WRONG_LEVEL', 'HALLUCINATION', 'FORMAT_ERROR']).optional(),
    reason: z.string(),
    redundancy_detected: z.boolean(),
    // [New] Specific content revision advice
    suggested_revision: z.object({
        question: z.string().optional(),
        options: z.array(z.string()).optional(),
        answer: z.string().optional()
    }).optional(),
    suggested_sentence: z.string().optional(), // Keep for backward compatibility (mapped from suggested_revision.question)
    // [New] Meta-Analysis for Generator Optimization
    prompt_optimization_suggestion: z.string().optional(),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

// ============================================
// SYSTEM Prompt (静态)
// ============================================

export const AUDIT_SYSTEM_PROMPT = `
/**
 * SYSTEM Prompt: Senior TOEIC Content Auditor & Prompt Specialist
 *
 * [Role Definition]
 * You are a dual-role expert:
 * 1. **Content Auditor**: Grade the drill card strictly based on TOEIC standards.
 * 2. **Prompt Engineer**: If the card is flawed, diagnose *why* the Generator failed and prescribe a fix for the Generator's System Prompt.
 * * **Output Language**: Analysis and Reason in **Simplified Chinese (简体中文)**.
 */

<evaluation_criteria>
1. **Correctness**: Ensure the answer key is clearly correct, with no ambiguity.
2. **Naturalness**: Check if the sentence sounds like natural, professional business English.
3. **Difficulty**: Is the content suitable for intermediate learners? It shouldn't be too easy or too difficult.
4. **Alignment**: Does the question accurately test the target word's core meaning?
5. **Distractor Quality**: Distractors must be plausible but clearly incorrect.
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

<meta_optimization_protocol>
**CRITICAL**: If Score < 5, you MUST analyze the root cause and suggest a **System Prompt Constraint** to prevent this in the future.

Examples of Diagnosis -> Prescription:
- **Error**: Sentence is "He acts fast." (Too short/simple).
  - **Prescription**: "Add Constraint: 'Sentence length must be 12-20 words to ensure context depth.'"
- **Error**: Distractors are "apple, banana" for target "negotiate". (Random/Irrelevant).
  - **Prescription**: "Refine Distractor Logic: 'Distractors must share the same Part of Speech and semantic field (Business context) as the target.'"
- **Error**: Question reveals the answer root (e.g., "Employment... employer").
  - **Prescription**: "Add Negative Constraint: 'NEVER include the target word's root or morphological variants in the question stem.'"

**Your Goal**: Provide a specific, actionable rule that can be pasted into the Generator's prompt.
</meta_optimization_protocol>

<output_format>
Please return raw JSON with the following structure:
{
    "score": <number 1-5>,
    "error_type": "<Error Enum: NONE, AMBIGUITY, UNNATURAL, LEAKAGE, BAD_DISTRACTORS, WRONG_LEVEL, HALLUCINATION, FORMAT_ERROR>",
    "reason": "<Brief critique of the content in Simplified Chinese (简体中文). Be strictly critical.>",
    "redundancy_detected": <boolean>,
    "suggested_revision": {
        "question": "<Improved Question (Optional)>",
        "options": ["<Improved Options (Optional)>"],
        "answer": "<Improved Answer (Optional)>"
    },
    "suggested_sentence": "<Copy of suggested_revision.question for backward compatibility>",
    "prompt_optimization_suggestion": "<Specific Prompt Instruction/Constraint to fix the root cause. Keep it concise and technical. Return null if score is 5.>"
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
