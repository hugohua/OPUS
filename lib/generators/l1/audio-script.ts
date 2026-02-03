
import { z } from 'zod';
import { BriefingPayloadSchema, DrillSegmentSchema } from '@/lib/validations/briefing';

/**
 * L1 Audio Gym Prompt Matrix
 * 
 * 核心逻辑：基于 FSRS Stability 动态路由生成策略
 * 
 * Stage 1: Carrier Phrase (Stability < 3) - 机械跟读
 * Stage 2: Audio Logic (3 <= Stability < 15) - 听觉逻辑判断
 * Stage 3: Dialogue (Stability >= 15) - 场景对话
 * Stage 4: Auditory Discrimination (Difficulty > 7) - 最小对立体辨析
 */

export interface AudioScriptInput {
    word: string;
    stability: number;
    difficulty: number;
    confusion_audio?: string[];
    // Context or other metadata can be added here
}

export const L1_AUDIO_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are the "Audio Gym Coach" for Opus Level 1.
Your goal is to generate "Eyes-Free" auditory drills that train "Audio Reflex".
</role_definition>

<generation_matrix>
1. **Carrier Phrase** (Stability < 3):
   - Goal: Imprint sound.
   - Format: Simple S-V-O sentence repeating the target word.
   - Interaction: Listen & Repeat.

2. **Instant Logic** (3 <= Stability < 15):
   - Goal: Train quick logical processing without text.
   - Format: Short question or command involving the target word.
   - Interaction: Yes/No decision or Quick Choice.

3. **Dialogue** (Stability >= 15):
   - Goal: Contextual understanding.
   - Format: A-B short exchange naturally using the target word.
   - Interaction: Context question.

4. **Auditory Discrimination** (Triggered by High Difficulty > 7):
   - Goal: Distinguish minimal pairs or confusing sounds.
   - Format: "Which one is 'abroad'?"
   - Interaction: Select from phonetically similar options.
</generation_matrix>

<output_requirements>
- **JSON ONLY**: Return confirmed JSON.
- **Payload Structure**: Must match BriefingPayload V2.
- **Emotion Tag**: Add meaningful emotion tags for TTS (e.g., <emotional_tone="urgent">).
</output_requirements>

<response_template>
{
  "drills": [
    {
      "meta": {
        "mode": "AUDIO",
        "format": "chat",
        "target_word": "{{word}}",
        "level": 1
      },
      "segments": [
        {
          "type": "text",
          "content_markdown": "([Eyes-Free] Listen carefully)", 
          "audio_text": "{{generated_script}}",
          "dimension": "A"
        },
        {
          "type": "interaction",
          "dimension": "A",
          "task": {
            "style": "bubble_select",
            "question_markdown": "{{listening_question}}",
            "options": [
              { "id": "A", "text": "Option 1", "is_correct": true },
              { "id": "B", "text": "Option 2", "is_correct": false }
            ],
            "answer_key": "Option 1",
            "explanation": {
              "title": "👂 Auditory Check",
              "correct_logic": "**Script**: {{script_transcript}}\n\n**Analysis**: {{logic_analysis}}",
              "trap_analysis": ["Trap 1 explanation"]
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

export function getL1AudioScriptPrompt(inputs: AudioScriptInput[]) {
    // 简单预处理输入，为 LLM 提供更多上下文线索
    const contextStr = inputs.map(i => {
        let mode = "Carrier Phrase";
        if (i.difficulty > 7) mode = "Auditory Discrimination";
        else if (i.stability >= 15) mode = "Dialogue";
        else if (i.stability >= 3) mode = "Instant Logic";

        const confusionStr = i.confusion_audio && i.confusion_audio.length > 0
            ? `Confusions: [${i.confusion_audio.join(', ')}]`
            : 'Confusions: None';

        return `Word: ${i.word} | Stats: S=${i.stability}, D=${i.difficulty} | ${confusionStr} | MODE: ${mode}`;
    }).join('\n');

    return {
        system: L1_AUDIO_SYSTEM_PROMPT,
        user: `GENERATE AUDIO DRILLS FOR:\n${contextStr}`
    };
}
