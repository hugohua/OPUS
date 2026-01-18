import { z } from 'zod';
import { logAIError } from '@/lib/logger';

/**
 * 清理 Markdown 代码块标记
 */
export function cleanMarkdown(content: string): string {
    return content.replace(/```json\n?|\n?```/g, '').replace(/```\n?|\n?```/g, '').trim();
}

/**
 * 修复 AI 输出的常见 JSON 错误
 * - 移除 Markdown 标记
 * - 修复尾随逗号
 * - 修复连续逗号
 */
export function repairJson(content: string): string {
    let repaired = content.trim();

    // 1. 移除 Markdown 代码块
    repaired = cleanMarkdown(repaired);

    // 2. 移除无效的 Unicode 字符
    repaired = repaired.replace(/[\uFFFD\u0000-\u001F]/g, '');

    // 3. 清理连续逗号
    repaired = repaired.replace(/,\s*,/g, ',');

    // 4. 移除数组尾随逗号
    repaired = repaired.replace(/,\s*\]/g, ']');

    // 5. 移除对象尾随逗号
    repaired = repaired.replace(/,\s*\}/g, '}');

    return repaired;
}

/**
 * AI 解析上下文 (用于错误日志)
 */
export interface ParseContext {
    systemPrompt?: string;
    userPrompt?: string;
    model?: string;
}

/**
 * 安全解析 JSON 并使用 Zod 验证
 * @param content - AI 返回的原始文本
 * @param schema - Zod Schema 用于验证
 * @param context - 可选，用于错误日志的上下文信息
 */
export function safeParse<T>(content: string, schema: z.ZodSchema<T>, context?: ParseContext): T {
    try {
        const cleaned = repairJson(content);
        const parsed = JSON.parse(cleaned);

        // 处理 AI 返回数组而非对象的情况
        if (Array.isArray(parsed)) {
            // 检查 schema 是否期望 { items: [...] } 结构
            return schema.parse({ items: parsed });
        }

        return schema.parse(parsed);
    } catch (error) {
        // 记录详细错误日志
        logAIError({
            error,
            systemPrompt: context?.systemPrompt,
            userPrompt: context?.userPrompt,
            rawResponse: content,
            model: context?.model,
            context: 'JSON 解析/验证失败',
        });

        throw error;
    }
}

/**
 * 计算学习优先级（基于靶心分层策略）
 * 
 * PRD 定义:
 * - P0 核心区 (100): 商务标签 + 难度 > A2
 * - P1 支撑区 (60): B1-C2 非商务词
 * - P2 噪音区 (0): A1/A2 简单词
 * 
 * @param is_toeic_core - 是否为商务核心词
 * @param cefrLevel - CEFR 等级 (A1, A2, B1, B2, C1, C2)
 * @returns 100 (核心) | 60 (支撑) | 0 (噪音)
 */
export function calculatePriority(
    is_toeic_core: boolean,
    cefrLevel: string | null | undefined
): number {
    // 规范化 CEFR 等级
    const level = (cefrLevel || '').toUpperCase().trim();
    const highLevels = ['B1', 'B2', 'C1', 'C2'];
    const lowLevels = ['A1', 'A2'];

    // P0 核心区：商务标签 + 难度 > A2 (即 B1 及以上)
    if (is_toeic_core && highLevels.includes(level)) {
        return 100;
    }

    // P2 噪音区：A1/A2 简单词（无论是否商务词）
    if (lowLevels.includes(level)) {
        return 0;
    }

    // P1 支撑区：B1-C2 非商务词
    if (highLevels.includes(level)) {
        return 60;
    }

    // 未知等级的商务词仍给予较高优先级
    if (is_toeic_core) {
        return 100;
    }

    // 兜底：未知等级非商务词
    return 60;
}
