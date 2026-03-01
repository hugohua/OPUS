"use server";
/**
 * 错题诊断 Server Action（已弃用）
 *
 * [V3.1 Breaking Change] AI 诊断已迁移至流式 SSE API Route:
 *   → app/api/diagnostic/route.ts
 *
 * 此文件仅保留类型导出以兼容可能的下游引用。
 * 实际的 LLM 调用、缓存逻辑、流式输出均在 API Route 中实现。
 */

// 保留类型导出（向后兼容）
export type MistakeDiagnosticPayload = {
    core_test_point: string;
    root_cause: string;
    syntax_rule: {
        explanation: string;
        keywords: string[];
    };
    quick_rule: string;
    skeleton: {
        original: string;
        breakdown: string;
    };
    business_translation: string;
    valid_contexts: {
        sentence: string;
        target_word: string;
        explanation: string;
    }[];
};
