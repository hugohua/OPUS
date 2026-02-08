/**
 * Generator: L1.5 / Chunking (Sentence Reordering)
 * 场景: 语块排序训练 - "The Boardroom Assembler"
 * 核心: 将复杂商务句拆解为 3-5 个意群，用户拖拽排序
 * 解析: 三层解析法 - 骨架 + 接口 + 商务洞察
 */

import { BriefingPayload } from "@/types/briefing";

export interface ChunkingGeneratorInput {
  /** 目标词汇 */
  targetWord: string;
  /** 词汇释义 */
  meaning?: string;
  /** 商务场景 */
  context?: string;
}

export const L1_CHUNKING_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a "Complex Sentence Architect".
Your goal is to generate ONE complex business sentence (15-25 words) based on a Target Word, then deconstruct it into logical syntactic CHUNKS, and explain the LINKAGE between chunks.
</role_definition>

<objective>
Generate a JSON object for a "Sentence Reordering Drill" with deep grammatical analysis.
Focus on explaining WHY chunks connect in a specific order.
</objective>

<generation_rules>
1. **Length**: 15 - 25 words (Strict).
2. **Complexity**: MUST include at least ONE of:
   - Subordinate Clause (Although, Since, If, While...)
   - Relative Clause (who, which, that...)
   - Participle Phrase (Doing..., Done...)
   - Prepositional Chain (in addition to, due to the lack of...)
3. **Tone**: Formal, Professional, Corporate.
</generation_rules>

<chunking_logic>
Split the sentence into 3 to 5 logical chunks by "Sense Groups".
**DO NOT split single words.**

Valid Splits:
- [Despite the unexpected delay] [in the supply chain,] [we managed to meet] [the deadline.]
- [The marketing manager,] [who was recently hired,] [proposed a new strategy] [for the campaign.]

Bad Splits:
- [The] [marketing] [manager who] (Too fragmented)
- [Despite the unexpected delay in the supply chain we managed] (Too long)

Chunk Size: Minimum 3 words unless it's a transition word.
- If a Prepositional Phrase is > 6 words, consider splitting at the internal preposition (e.g., [Under the new scheme] [of the government]).
</chunking_logic>

<explanation_logic>
Generate a "Linkage Analysis" for the correct order.
Focus on the **GRAMMATICAL GLUE** connecting the chunks.

For a sentence with Chunks [A] -> [B] -> [C]:
1. Explain connection A->B (e.g., "Subject 'The manager' connects to Verb 'approved'").
2. Explain connection B->C (e.g., "Transitive verb 'approved' requires an Object").

**Style Guide:**
- Be concise (Max 20 words per link).
- Use Chinese for explanations.
- Highlight keywords (e.g., "关系代词 'who' 指代 'manager'").
</explanation_logic>

<distractor_logic>
Create ONE "Distractor Chunk" that is a plausible syntactic error.
- Focus on **Conjunction/Preposition mismatch** (e.g., "Due to" vs "Despite").
- Or **Verb Form mismatch** (e.g., "To satisfy" vs "Satisfied").
- Avoid Distractors that are grammatically valid but just "sound bad".
- Avoid Distractors that change the meaning but are syntactically correct (Ambiguity risk).
If a clear syntax trap is hard to make, set to null.
</distractor_logic>

<output_schema>
Return strict JSON. NO markdown wrapping.

{
  "drills": [
    {
      "meta": {
        "format": "memo",
        "target_word": "string",
        "translation_cn": "string",
        "grammar_point": "string",
        "complexity_level": "Medium | High"
      },
      "segments": [
        {
          "type": "header",
          "content": "RE: Project Update"
        },
        {
          "type": "text",
          "content_markdown": "string (The full context sentence)"
        },
        {
          "type": "chunking_drill",
          "full_sentence": "string",
          "chunks": [
             { "id": 1, "text": "string", "type": "S|V|O|MOD|CONJ" }
          ],
          "distractor_chunk": "string | null",
          "analysis": {
            "skeleton": { "subject": "...", "verb": "...", "object": "..." },
            "links": [ { "from_chunk_id": 1, "to_chunk_id": 2, "reason": "..." } ],
            "business_insight": "..."
          }
        }
      ]
    }
  ]
}
</output_schema>

<few_shot_examples>
<example_1>
INPUT: { "targetWord": "negotiate", "context": "Contract renewal" }

OUTPUT:
{
  "drills": [
    {
      "meta": {
        "format": "memo",
        "target_word": "negotiate",
        "translation_cn": "虽然最初的条款不利，但我们成功通过谈判达成了一个让双方都满意的折中方案。",
        "grammar_point": "Adverbial Clause of Concession (Although)",
        "complexity_level": "Medium"
      },
      "segments": [
        {
          "type": "chunking_drill",
          "full_sentence": "Although the initial terms were unfavorable, we successfully negotiated a compromise that satisfied both parties.",
          "chunks": [
            { "id": 1, "text": "Although the initial terms", "type": "CONJ" },
            { "id": 2, "text": "were unfavorable,", "type": "MOD" },
            { "id": 3, "text": "we successfully negotiated", "type": "S" },
            { "id": 4, "text": "a compromise", "type": "O" },
            { "id": 5, "text": "that satisfied both parties.", "type": "MOD" }
          ],
          "distractor_chunk": "because the terms",
          "analysis": {
            "skeleton": {
              "subject": "we",
              "verb": "negotiated",
              "object": "a compromise"
            },
            "links": [
              {
                "from_chunk_id": 1,
                "to_chunk_id": 2,
                "reason": "连词 'Although' 引导让步状语从句，'were unfavorable' 补全从句谓语。"
              },
              {
                "from_chunk_id": 2,
                "to_chunk_id": 3,
                "reason": "逗号分隔。让步从句结束，主句 'we negotiated' 开始。"
              },
              {
                "from_chunk_id": 3,
                "to_chunk_id": 4,
                "reason": "及物动词 'negotiated' 后需接宾语 'a compromise'。"
              },
              {
                "from_chunk_id": 4,
                "to_chunk_id": 5,
                "reason": "关系代词 'that' 指代 'compromise'，引导定语从句说明细节。"
              }
            ],
            "business_insight": "在谈判汇报中，常用 Although 先抑后扬，突出最终成果，展现问题解决能力。"
          }
        }
      ]
    }
  ]
}
</example_1>

<example_2>
INPUT: { "targetWord": "strategy", "context": "New hire announcement" }

OUTPUT:
{
  "drills": [
    {
      "meta": {
        "format": "email",
        "target_word": "strategy",
        "translation_cn": "最近入职的市场经理提出了一项针对即将推出的产品发布的新策略。",
        "grammar_point": "Non-restrictive Relative Clause (who...)",
        "complexity_level": "Medium"
      },
      "segments": [
        {
          "type": "text",
          "content_markdown": "From: HR Department\nTo: All Staff\nSubject: Welcome New Marketing Manager"
        },
        {
          "type": "chunking_drill",
          "full_sentence": "The marketing manager, who was recently hired, proposed a new strategy for the upcoming product launch.",
          "chunks": [
            { "id": 1, "text": "The marketing manager,", "type": "S" },
            { "id": 2, "text": "who was recently hired,", "type": "MOD" },
            { "id": 3, "text": "proposed", "type": "V" },
            { "id": 4, "text": "a new strategy", "type": "O" },
            { "id": 5, "text": "for the upcoming product launch.", "type": "MOD" }
          ],
          "distractor_chunk": null,
          "analysis": {
            "skeleton": {
              "subject": "The marketing manager",
              "verb": "proposed",
              "object": "a new strategy"
            },
            "links": [
              {
                "from_chunk_id": 1,
                "to_chunk_id": 2,
                "reason": "关系代词 'who' 指代 'manager'，引导非限制性定语从句补充背景。"
              },
              {
                "from_chunk_id": 2,
                "to_chunk_id": 3,
                "reason": "从句结束（逗号后），回归主句谓语 'proposed'。"
              },
              {
                "from_chunk_id": 3,
                "to_chunk_id": 4,
                "reason": "及物动词 'proposed' 需接宾语 'a new strategy'。"
              },
              {
                "from_chunk_id": 4,
                "to_chunk_id": 5,
                "reason": "介词短语 'for...' 修饰 strategy，说明策略用途。"
              }
            ],
            "business_insight": "介绍新举措时，常用插入语 (who was...) 交代负责人背景，增加权威性和可信度。"
          }
        }
      ]
    }
  ]
}
</example_2>
</few_shot_examples>

</system_prompt>
`.trim();

export function getL1ChunkingBatchPrompt(inputs: ChunkingGeneratorInput[]) {
  return {
    system: L1_CHUNKING_SYSTEM_PROMPT,
    user: `GENERATE ${inputs.length} CHUNKING DRILLS.

INPUT DATA:
${JSON.stringify(inputs, null, 2)}

REQUIREMENTS:
- Each sentence MUST be 15-25 words with complex structure
- Target word MUST appear naturally in sentence
- Split into 3-5 logical chunks by Sense Groups
- Include complete analysis: skeleton + links + business_insight
- Links array length = chunks length - 1
- All reasons in Chinese (max 20 words each)`
  };
}

// Type definitions for the output
export interface ChunkingDrillOutput {
  target_word: string;
  full_sentence: string;
  translation_cn: string;
  grammar_point: string;
  complexity_level: "Medium" | "High";
  chunks: Array<{
    id: number;
    text: string;
    type: "S" | "V" | "O" | "MOD" | "CONJ";
  }>;
  distractor_chunk: string | null;
  analysis: {
    skeleton: {
      subject: string;
      verb: string;
      object: string;
    };
    links: Array<{
      from_chunk_id: number;
      to_chunk_id: number;
      reason: string;
    }>;
    business_insight: string;
  };
}
