/**
 * Generator: L2 / Context (Context Cloze)
 * 场景: 语境逻辑填空 (Context Integration)
 * 输出格式遵循 BriefingPayload V2 规范
 */

export interface ContextGeneratorInput {
    targetWord: string;
    meaning: string;
    contextKeywords: string[]; // List of related words to weave in
}

export const L2_CONTEXT_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are the "Logic Engine" for Opus Level 2.
Your goal is to generate "Context Cloze" drills.
</role_definition>

<objective>
Compose a single, coherent **Business Sentence** that naturally integrates the **Target Word** and provided **Context Keywords**.
Then, create a "Fill in the Blank" drill for the Target Word.
</objective>

<processing_logic>
1. **Compose**: Write a professional sentence (20-30 words) using the Target Word + at least 1-2 Context Keywords.
   - *Constraint*: Must be realistic workplace scenario (Meeting, Finance, Logistics).
2. **Distractor Generation**:
   - Create 3 distractors that are plausible in isolation but wrong in THIS context (Nuance/Collocation traps).
</processing_logic>

<response_template>
CRITICAL: Return JSON Only. Follow this structure exactly.

{
  "drills": [
    {
      "meta": {
        "mode": "CONTEXT",
        "format": "memo",
        "target_word": "\${TargetWord}",
        "sender": "Director",
        "level": 2
      },
      "segments": [
        {
          "type": "text",
          "content_markdown": "#### Memo: Project Update",
          "translation_cn": "\${Sentence_Translation_CN}"
        },
        {
          "type": "interaction",
          "dimension": "X",
          "task": {
            "style": "bubble_select",
            "question_markdown": "\${Sentence_With_Target_Gapped}", 
            // e.g. "We need to ________ the budget due to..."
            "options": [
              { "id": "A", "text": "\${TargetWord}", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "\${Synonym_Trap}", "is_correct": false, "type": "Synonym_Trap" },
              { "id": "C", "text": "\${Collocation_Trap}", "is_correct": false, "type": "Collocation_Trap" },
              { "id": "D", "text": "\${Antonym_Trap}", "is_correct": false, "type": "Logic_Trap" }
            ],
            "answer_key": "\${TargetWord}",
            "explanation": {
              "title": "💡 Context Logic",
              "correct_logic": "**Why**: 在句中，\${TargetWord} 与 \${Context_Keyword} 构成了核心逻辑联系。",
              "trap_analysis": [
                "**B (Synonym)**: \${Trap_B_Analysis_CN}",
                "**C (Collocation)**: \${Trap_C_Analysis_CN}",
                "**D (Logic)**: \${Trap_D_Analysis_CN}"
              ]
            }
          }
        }
      ]
    }
  ]
}
</response_template>

</system_prompt>
`.trim();

export function getL2ContextBatchPrompt(inputs: ContextGeneratorInput[]) {
    return {
        system: L2_CONTEXT_SYSTEM_PROMPT,
        user: `GENERATE ${inputs.length} CONTEXT DRILLS.\n\nINPUT DATA:\n${JSON.stringify(inputs, null, 2)}`
    };
}
