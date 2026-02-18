/**
 * Weaver Context Generator - L2 商务阅读材料生成 (v2.0)
 * 
 * 功能：
 *   为 Weaver Lab V2 提供 Production-Ready Prompt
 *   - 静态 System Prompt (角色/语调/工程红线/输出格式)
 *   - 动态 User Prompt (场景/篇幅/词表 + POS 标注)
 * 
 * v2.0 三大改进 (vs v1.0):
 *   1. 结构化分隔符 (===TITLE=== / ===BODY===) — 解决流式解析风险
 *   2. 词形控制 (Morphology Control) — 防止词性漂移导致魔法棒查不到数据
 *   3. No Meta-Talk — 禁止 LLM 输出废话前缀
 * 
 * 作者: Hugo
 * 日期: 2026-02-16
 */

import { z } from "zod";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenario-map";

// ============================================
// Type Definitions
// ============================================

export const WeaverScenarioSchema = z.enum(WEAVER_SCENARIOS as [string, ...string[]]);
export type WeaverScenario = z.infer<typeof WeaverScenarioSchema>;

export type WeaverDensity = "light" | "balanced" | "dense";

export interface WeaverContextInput {
    targetWords: Array<{ id: number; word: string; definition_cn: string; pos?: string }>;
    scenario: string;
    density?: WeaverDensity;
}

// ============================================
// System Prompt (固定常量 — v2.0)
// ============================================

export const WEAVER_CONTEXT_SYSTEM_PROMPT = `
# Role
You are the "Opus AI Writer", an expert in TOEIC Business English.
Your goal is to generate a professional reading passage based on specific vocabulary constraints.

# Tone & Style
- **Register**: Formal Business English (Standard TOEIC Part 6/7 style).
- **Structure**: Logical flow, clear paragraphing.
- **Audience**: Business professionals or job seekers.

# Critical Constraints (MUST FOLLOW)
1. **Vocabulary Embedding**: You MUST use ALL words listed in \`<target_words>\`.
2. **Morphology Control**:
   - Keep the **Part of Speech (POS)** consistent with the input.
   - ALLOW: Verb tense changes (predict -> predicted), Plural forms (asset -> assets).
   - **FORBID**: Changing the word family (predict -> prediction/unpredictable is BANNED).
3. **Highlighting**: Wrap target words in double asterisks, e.g., **targetWord**.
4. **No Meta-Talk**: Do not output "Here is the article". Start directly with the content.

# Output Format
You must output in a strict format with separators:

===TITLE===
(Write a concise, professional title here)
===BODY===
(Write the article content here. Use paragraphs.)
`.trim();

// ============================================
// 场景上下文映射 (静态常量)
// ============================================

// ============================================
// 场景上下文映射 (优化版 - 融入 TOEIC 文体)
// ============================================

const SCENARIO_CONTEXT: Record<string, string> = {
    finance_group: `
        Context: A formal financial document.
        Type: An internal audit report, a quarterly earnings memo, or an investment proposal email.
        Focus: Budget cuts, revenue forecasts, tax compliance, or merger details.
    `.trim(),

    hr_group: `
        Context: Human Resources communication.
        Type: A job advertisement, an internal policy memo, a resignation letter, or a performance review email.
        Focus: Recruitment, benefits, conflict resolution, or training schedules.
    `.trim(),

    market_group: `
        Context: Marketing & Sales strategy.
        Type: A press release, a product launch announcement, a customer survey email, or a sales performance report.
        Focus: Brand awareness, market share, advertising campaigns, or customer retention.
    `.trim(),

    ops_group: `
        Context: Production & Logistics.
        Type: A supply chain update, a quality control checklist, a factory safety notice, or a shipping delay apology email.
        Focus: Inventory levels, manufacturing defects, procurement delays, or logistics optimization.
    `.trim(),

    office_group: `
        Context: General Business Administration.
        Type: An inter-office memo, a meeting agenda, a business travel itinerary, or a facility maintenance notice.
        Focus: Office relocation, equipment upgrades, conference planning, or administrative procedures.
    `.trim(),

    travel_group: `
        Context: Business Travel & Events.
        Type: An itinerary confirmation, a conference schedule, a hotel booking email, or a post-event summary.
        Focus: Flight delays, dietary restrictions, keynote speakers, or networking opportunities.
    `.trim(),

    // Fallback for sub-contexts if passed directly (legacy support)
    general_business: "A general business memo or email regarding daily operations.",
};

// ============================================
// Density 篇幅约束
// ============================================

const DENSITY_CONFIG: Record<WeaverDensity, { wordRange: string; paragraphs: string }> = {
    light: { wordRange: "120-180", paragraphs: "2" },
    balanced: { wordRange: "200-300", paragraphs: "2-3" },
    dense: { wordRange: "350-450", paragraphs: "3-4" },
};

// ============================================
// User Prompt Builder (v2.0)
// ============================================

/**
 * 构建 Weaver Context 用户 Prompt (v2.0)
 * 
 * 改进点:
 *   - 场景描述和篇幅约束从 System Prompt 下移到此处
 *   - 目标词带 POS 标注 (e.g., "negotiate (verb)")
 *   - 使用 XML 标签包裹词表 (便于幻觉检测)
 *   - 支持 "Slot Machine" 逻辑
 * 
 * @param input 包含目标词、场景(Group)和 Sub-Context
 */
export function buildWeaverContextUserPrompt(input: WeaverContextInput & { subContext?: string }): string {
    const density = input.density || "balanced";
    const densityCfg = DENSITY_CONFIG[density];

    // 1. Get Base Context (from Group ID)
    let scenarioCtx = SCENARIO_CONTEXT[input.scenario] || SCENARIO_CONTEXT.office_group || "General business context";

    // 2. Append Specific Focus (from Sub-Tag) if present
    if (input.subContext && input.subContext !== input.scenario) {
        scenarioCtx += `\nSPECIFIC TOPIC: Focus includes **${input.subContext.replace('_', ' ')}**.`;
    }

    const wordList = input.targetWords
        .map(w => {
            const posTag = w.pos ? ` (${w.pos})` : '';
            return `- ${w.word}${posTag}`;
        })
        .join('\n');

    return `
## Context Scenario
${scenarioCtx}

## Constraints
- Length: ${densityCfg.wordRange} words.
- Structure: ${densityCfg.paragraphs} paragraphs.

<target_words>
${wordList}
</target_words>

Generate the article now.
    `.trim();
}

// ============================================
// Validation Schema
// ============================================

export const WeaverContextInputSchema = z.object({
    targetWords: z.array(z.object({
        id: z.number(),
        word: z.string(),
        definition_cn: z.string(),
        pos: z.string().optional()
    })).max(15),
    scenario: WeaverScenarioSchema,
    density: z.enum(["light", "balanced", "dense"]).default("balanced")
});
