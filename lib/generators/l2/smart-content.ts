/**
 * Generator: L2 / SmartContent (例句生成)
 * 用途: Word Detail Page 的 ContextSnapshot 模块
 * 生成可复用的 L2 商务例句 + 中文翻译
 */

import { z } from 'zod';

// ============================================================
// Zod Schema (用于校验 LLM 输出)
// ============================================================

export const L2SentencePayloadSchema = z.object({
    text: z.string().describe("The English business sentence (15-25 words)"),
    translation: z.string().describe("Chinese translation of the sentence"),
    scenario: z.string().describe("Business scenario tag, e.g. 'Email', 'Meeting', 'Report'"),
});

export type L2SentencePayload = z.infer<typeof L2SentencePayloadSchema>;

// ============================================================
// System Prompt (静态)
// ============================================================

export const L2_SMART_CONTENT_SYSTEM_PROMPT = `
<system_prompt>
<role_definition>
You are a professional TOEIC content writer for Opus, a workplace simulator app.
Your goal is to generate **high-quality, realistic business sentences** that naturally incorporate the target vocabulary word.
</role_definition>

<constraints>
1. **Sentence Length**: 15-25 words. Not too short (lacking context), not too long (cognitive overload).
2. **Business Realism**: Must sound like real workplace communication (Email, Meeting, Report, HR Announcement).
3. **Target Word Usage**: The word must be used correctly in its business meaning, not a casual or informal sense.
4. **Translation Quality**: Chinese translation must be natural and fluent, not word-for-word literal translation.
5. **S-V-O Structure**: Prefer clear Subject-Verb-Object structure for L0/L1 learners.
</constraints>

<available_scenarios>
- Email: Professional email communication
- Meeting: During a business meeting or discussion
- Report: Written in a business report or memo
- HR: Human Resources announcements or policies
- Finance: Budget, expense, or financial discussions
- Logistics: Supply chain, shipping, or operations
</available_scenarios>
</system_prompt>
`.trim();

// ============================================================
// User Prompt Builder (动态)
// ============================================================

export interface SmartContentInput {
    word: string;
    definition?: string;
    scenario?: string; // 可选指定场景，否则随机
}

export function buildL2SentenceUserPrompt(input: SmartContentInput): string {
    const scenarioInstruction = input.scenario
        ? `Use scenario: ${input.scenario}`
        : 'Choose an appropriate scenario from the available list';

    return `
Generate a business sentence for the word "${input.word}".
${input.definition ? `Definition hint: ${input.definition}` : ''}
${scenarioInstruction}

Return JSON in this exact format:
{
  "text": "The English sentence",
  "translation": "中文翻译",
  "scenario": "Email"
}
`.trim();
}

// ============================================================
// Deterministic Fallback (降级兜底)
// ============================================================

const FALLBACK_TEMPLATES = [
    { scenario: 'Email', template: 'Please {word} the document and send it by EOD.' },
    { scenario: 'Meeting', template: 'We need to {word} this matter during the next meeting.' },
    { scenario: 'Report', template: 'The report shows we must {word} our approach to achieve better results.' },
];

export function getDeterministicL2(word: string, definition?: string): L2SentencePayload {
    const templateIndex = word.length % FALLBACK_TEMPLATES.length;
    const { scenario, template } = FALLBACK_TEMPLATES[templateIndex];

    return {
        text: template.replace('{word}', word),
        translation: definition || `请在商务场景中使用 "${word}"`,
        scenario,
    };
}

// ============================================================
// 批量生成 Schema (一次生成 6 个场景)
// ============================================================

export const L2BatchPayloadSchema = z.object({
    sentences: z.array(L2SentencePayloadSchema).length(6).describe(
        "Array of 6 sentences, one for each scenario: Email, Meeting, Report, HR, Finance, Logistics"
    ),
});

export type L2BatchPayload = z.infer<typeof L2BatchPayloadSchema>;

// 场景列表 (静态常量)
export const L2_SCENARIOS = ['Email', 'Meeting', 'Report', 'HR', 'Finance', 'Logistics'] as const;
export type L2Scenario = typeof L2_SCENARIOS[number];

// ============================================================
// 批量生成 User Prompt (动态)
// ============================================================

export function buildL2BatchUserPrompt(word: string, definition?: string): string {
    return `
Generate 6 business sentences for the word "${word}", one for EACH scenario.
${definition ? `Definition hint: ${definition}` : ''}

You MUST generate exactly 6 sentences, one for each scenario in this order:
1. Email - Professional email communication
2. Meeting - During a business meeting
3. Report - Written in a business report or memo
4. HR - Human Resources announcements
5. Finance - Budget or financial discussions
6. Logistics - Supply chain or operations

Return JSON in this exact format:
{
  "sentences": [
    { "text": "...", "translation": "...", "scenario": "Email" },
    { "text": "...", "translation": "...", "scenario": "Meeting" },
    { "text": "...", "translation": "...", "scenario": "Report" },
    { "text": "...", "translation": "...", "scenario": "HR" },
    { "text": "...", "translation": "...", "scenario": "Finance" },
    { "text": "...", "translation": "...", "scenario": "Logistics" }
  ]
}
`.trim();
}

// ============================================================
// 批量 Fallback (降级兜底)
// ============================================================

const BATCH_FALLBACK_TEMPLATES: Record<L2Scenario, string> = {
    'Email': 'Please {word} the document and send it by EOD.',
    'Meeting': 'We need to {word} this matter during the meeting.',
    'Report': 'The report shows we must {word} our approach.',
    'HR': 'HR will {word} the new policy next week.',
    'Finance': 'We should {word} the budget for Q4.',
    'Logistics': 'The team will {word} the shipment schedule.',
};

export function getDeterministicL2Batch(word: string, definition?: string): L2SentencePayload[] {
    return L2_SCENARIOS.map(scenario => ({
        text: BATCH_FALLBACK_TEMPLATES[scenario].replace('{word}', word),
        translation: definition || `请在 ${scenario} 场景中使用 "${word}"`,
        scenario,
    }));
}
