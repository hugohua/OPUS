/**
 * Weaver Context Generator - L2 商务阅读材料生成
 * 
 * 功能：
 *   为 Weaver Lab V2 提供 Scenario-Driven Prompt 生成逻辑
 * 
 * 使用方法：
 *   import { WEAVER_CONTEXT_SYSTEM_PROMPT, buildWeaverContextUserPrompt } from '@/lib/generators/l2/weaver-context';
 * 
 * 作者: Hugo
 * 日期: 2026-02-05
 */

import { z } from "zod";

// ============================================
// Type Definitions
// ============================================

export const WeaverScenarioSchema = z.enum(["finance", "hr", "marketing", "rnd"]);
export type WeaverScenario = z.infer<typeof WeaverScenarioSchema>;

export interface WeaverContextInput {
    targetWords: Array<{ id: number; word: string; definition_cn: string }>;
    scenario: WeaverScenario;
}

// ============================================
// System Prompt (Static)
// ============================================

/**
 * Weaver Context 系统 Prompt
 * 
 * 根据 Scenario 动态调整上下文，但核心写作规范保持一致
 */
export function buildWeaverContextSystemPrompt(scenario: WeaverScenario): string {
    const scenarioContext = {
        finance: "主题：财务管理、审计、IPO、并购、预算控制。语境：正式商务财经报告。",
        hr: "主题：招聘、绩效管理、薪酬福利、团队建设。语境：人力资源政策文档。",
        marketing: "主题：市场营销、品牌策略、用户增长、广告投放。语境：营销方案报告。",
        rnd: "主题：研发管理、技术创新、产品迭代、专利申请。语境：R&D 项目复盘。"
    };

    return `
你是一位专业的商务英语写作专家。你的任务是撰写一篇简洁、连贯的商务短文。

## 场景要求
${scenarioContext[scenario]}

## 写作规范
1. **目标词嵌入**: 必须自然嵌入所有提供的目标词汇
2. **语调**: 正式、专业 (TOEIC B2-C1 级别)
3. **长度**: 200-300 词
4. **结构**: 逻辑清晰，分 2-3 段
5. **格式**: 使用 **粗体** 标记目标词 (例如：The **merger** was successful.)

## 输出格式
直接输出文章正文，无需标题。文章必须是英文，不要翻译。
    `.trim();
}

// ============================================
// User Prompt Builder
// ============================================

/**
 * 构建 Weaver Context 用户 Prompt
 * 
 * @param input - 包含目标词和场景信息
 * @returns 用户 Prompt 字符串
 */
export function buildWeaverContextUserPrompt(input: WeaverContextInput): string {
    const wordList = input.targetWords
        .map(w => `- ${w.word} (${w.definition_cn})`)
        .join('\n');

    return `
场景: ${input.scenario}

目标词汇 (必须全部嵌入):
${wordList}

请撰写文章。
    `.trim();
}

// ============================================
// Validation Schema
// ============================================

/**
 * 验证输入参数
 */
export const WeaverContextInputSchema = z.object({
    targetWords: z.array(z.object({
        id: z.number(),
        word: z.string(),
        definition_cn: z.string()
    })).min(1).max(15),
    scenario: WeaverScenarioSchema
});
