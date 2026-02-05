/**
 * Weaver Lab & Magic Wand - Schema Definitions
 * 
 * 用于 API 路由的请求/响应验证
 */

import { z } from "zod";

// ============================================
// Weaver V2 API Schemas
// ============================================

export const WeaverV2InputSchema = z.object({
    scenario: z.enum(["finance", "hr", "marketing", "rnd"]).describe("业务场景"),
    target_word_ids: z.array(z.number()).optional().describe("可选：手动指定目标词 ID，不传则 OMPS 自动装填")
});

export type WeaverV2Input = z.infer<typeof WeaverV2InputSchema>;

// ============================================
// Magic Wand API Schemas
// ============================================

export const WandWordQuerySchema = z.object({
    word: z.string().min(1).describe("查询的单词"),
    context_id: z.string().optional().describe("可选：上下文 ID (用于 AI 语境解析)")
});

export type WandWordQuery = z.infer<typeof WandWordQuerySchema>;

// 词源数据结构（与 Etymology 表对齐）
export const WandEtymologySchema = z.object({
    mode: z.enum(["ROOTS", "DERIVATIVE", "ASSOCIATION", "NONE"]),
    memory_hook: z.string().max(80).nullable(), // ✅ [W2 Fix] 对齐 PRD 长度限制
    data: z.record(z.string(), z.any()) // JSONB 字段
}).nullable();

// ✅ [W2 Fix] AI Insight Schema (异步 LLM 输出校验)
export const AIInsightSchema = z.object({
    collocation: z.string().describe("语境搭配"),
    nuance: z.string().describe("语义细节"),
    example: z.string().optional().describe("例句")
});

export type AIInsight = z.infer<typeof AIInsightSchema>;

// Magic Wand 完整响应
export const WandWordOutputSchema = z.object({
    vocab: z.object({
        phonetic: z.string(),
        meaning: z.string()
    }),
    etymology: WandEtymologySchema,
    ai_insight: AIInsightSchema.nullable().describe("初始为 null，前端通过 SSE 获取")
});

export type WandWordOutput = z.infer<typeof WandWordOutputSchema>;
