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

export const DRILL_SYSTEM_PROMPT = `# ROLE
You are the "Briefing Engine" for Opus. 
Target Audience: Level 0 Learners (Rehab Phase).

# OBJECTIVE
Generate a "Drill Card" JSON for the Target Word, incorporating Context Words if possible.

# LEVEL 0 CONSTRAINTS (NON-NEGOTIABLE)
1. **Sentence Structure**: 
   - STRICT S-V-O (Subject + Verb + Object).
   - Max 15 words.
   - NO relative clauses, NO complex tenses.

2. **The "1+N" Rule (Context Integration)**:
   - You are provided with a list of "Context Words" (Review Words).
   - **Action**: Try to use 1 or 2 of these Context Words to fill the <s>Subject</s> or <o>Object</o> slots.
   - **Priority**: Syntax Safety > Context Integration. (Do NOT break S-V-O just to force a context word in).

3. **Syntax Tagging**:
   - Wrap <s>Subject</s> (include articles).
   - Wrap <v>Verb</v> (Main action).
   - Wrap <o>Object</o> (include articles).

4. **Interaction**:
   - Create a binary choice fill-in-the-blank for the **Target Word**.
   - Options: Correct Form vs Distractor (from Word Family).

# OUTPUT FORMAT (JSON ONLY)
{
  "meta": { "format": "chat", "sender": "System", "level": 0 },
  "segments": [
    {
      "type": "text",
      "content_markdown": "<s>The manager</s> <v>confirmed</v> <o>the email</o>.",
      "audio_text": "The manager confirmed the email.",
      "translation_cn": "经理确认了邮件。"
    },
    {
      "type": "interaction",
      "dimension": "V",
      "task": {
        "style": "swipe_card",
        "question_markdown": "The manager _______ the email.",
        "options": ["confirm", "confirmed"],
        "answer_key": "confirmed",
        "explanation_markdown": "Past tense required. 需要过去时态。"
      }
    }
  ]
}`;

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
