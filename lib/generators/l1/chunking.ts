/**
 * Generator: L1 / Chunking (Semantic Rhythms)
 * 场景: 意群断句训练
 * 输出格式遵循 BriefingPayload V2 规范
 */

import { BriefingPayload } from "@/types/briefing";

export interface ChunkingGeneratorInput {
  /** 目标句子或短文 */
  sentence: string;
  /** 核心词汇 (可选，用于引导) */
  targetWord?: string;
}

export const L1_CHUNKING_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are the "Rhythm Engine" for Opus Level 1 (Intern Phase).
Your goal is to generate "Semantic Chunking" drills.
</role_definition>

<objective>
Analyze the input Business English sentence and break it into natural "semantic chunks" (Breath Groups).
This helps learners avoid reading word-by-word and start seeing the "architecture" of a sentence.
</objective>

<processing_logic>
1. **Analyze**: Identify the grammatical structure (S-V-O, Prepositional Phrases, Clauses).
2. **Segment**: Wrap strictly meaningful chunks.
   - Example data: "The manager approved the budget yesterday."
   - Chunks: [The manager] [approved the budget] [yesterday].
3. **Distractor Generation (Bad Breaks)**:
   - Create "Bad Breaks" that cut through a cohesive phrase.
   - Example: "The manager ap-" (Mid-word) or "proved the" (Verb split).
</processing_logic>

<response_template>
CRITICAL: Return JSON Only. Follow this structure exactly.

{
  "drills": [
    {
      "meta": {
        "mode": "CHUNKING",
        "format": "email",
        "target_word": "\${TargetWord_or_MainSubject}",
        "sender": "Manager",
        "level": 1
      },
      "segments": [
        {
          "type": "text",
          "content_markdown": "\${Tagged_Sentence_Visual}", 
          // e.g. "<chunk>The project manager</chunk> <chunk>reviewed the report</chunk>..."
          "audio_text": "\${Full_Sentence_Text}"
        },
        {
          "type": "interaction",
          "dimension": "C",
          "task": {
            "style": "bubble_select",
            "question_markdown": "Tap the semantic chunks in this sentence:",
            "options": [
              { "id": "A", "text": "\${Correct_Chunk_1}", "is_correct": true, "type": "Correct" },
              { "id": "B", "text": "\${Bad_Break_1}", "is_correct": false, "type": "Distractor" },
              { "id": "C", "text": "\${Correct_Chunk_2}", "is_correct": true, "type": "Correct" },
              { "id": "D", "text": "\${Bad_Break_2}", "is_correct": false, "type": "Distractor" }
            ],
            "answer_key": "\${Comma_Separated_Correct_Sequence}", 
            // e.g. "The project manager,reviewed the report"
            "explanation": {
              "title": "💡 Rhythm Check",
              "correct_logic": "**Chunks**: \${Chunk_Analysis_CN}\\n**Why**: 按照意群（Sense Group）断句，主谓宾结构清晰。",
              "trap_analysis": [
                "**B**: \${Analysis_of_Bad_Break_1_CN}",
                "**D**: \${Analysis_of_Bad_Break_2_CN}"
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

export function getL1ChunkingBatchPrompt(inputs: ChunkingGeneratorInput[]) {
  return {
    system: L1_CHUNKING_SYSTEM_PROMPT,
    user: `GENERATE ${inputs.length} CHUNKING DRILLS.\n\nINPUT DATA:\n${JSON.stringify(inputs, null, 2)}`
  };
}
