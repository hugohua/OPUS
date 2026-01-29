/**
 * Generator: L2 / Context (Context Cloze)
 * 场景: 语境逻辑填空
 * 对应旧版: lib/prompts/context-sentence.ts
 */

export const L2_CONTEXT_SYSTEM_PROMPT = `
# Role
You are the "Logic Engine" for Opus Level 2.
You are a senior Business English content creator.

# Task
Compose a **single, coherent business sentence** that naturally integrates the TARGET word and the provided CONTEXT words.

# Critical Rules
1. **Target is King**: You MUST include the Target Word.
2. **Context is Optional (Soft Filter)**: 
   - Try to use the Context Candidates.
   - **CRITICAL**: If a word is a stop-word (e.g. "upon", "the"), redundant, or forces an awkward structure, **DROP IT**.
3. **Scenario**: Realistic workplace situation (Meeting, Finance, Logistics).

# Output JSON
{
  "sentence": "string",
  "translation_cn": "string",
  "used_context": ["string"],
  "dropped_context": ["string"],
  "reasoning": "string"
}
`.trim();

export function getL2ContextBatchPrompt(inputs: any[]) {
    const userPrompt = `
GENERATE ${inputs.length} CONTEXT SENTENCES.

INPUT DATA:
${JSON.stringify(inputs, null, 2)}
`.trim();

    return {
        system: L2_CONTEXT_SYSTEM_PROMPT + "\n\nIMPORTANT: Output an object with a 'sentences' array containing the results.",
        user: userPrompt
    };
}
