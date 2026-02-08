import { z } from 'zod';
import { logAIError, aiLogger } from '@/lib/logger';

/**
 * 自定义 AI 解析错误
 * 携带原始 LLM 响应，便于审计调试
 */
export class AIParseError extends Error {
    readonly rawResponse: string;
    readonly zodError?: z.ZodError;

    constructor(message: string, rawResponse: string, zodError?: z.ZodError) {
        super(message);
        this.name = 'AIParseError';
        this.rawResponse = rawResponse;
        this.zodError = zodError;
    }
}

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
 * 尝试从截断的 JSON 中恢复已完成的 items
 * 策略：找到最后一个完整的 item 对象，截断后续内容并闭合 JSON
 */
export function recoverTruncatedJson(content: string): { recovered: string; itemsDropped: number } | null {
    console.log('[DEBUG] recoverTruncatedJson input:', content.slice(0, 100));
    try {
        // 查找 "items": [ 或 "drills": [ 的位置
        const itemsMatch = content.match(/"(items|drills)"\s*:\s*\[/);
        if (!itemsMatch || itemsMatch.index === undefined) {
            console.log('[DEBUG] No items/drills array found');
            return null;
        }

        const key = itemsMatch[1]; // "items" or "drills"
        const itemsStart = itemsMatch.index + itemsMatch[0].length;

        // 找到所有完整的 item 对象
        let lastCompleteEnd = -1;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let completeItems = 0;

        for (let i = itemsStart; i < content.length; i++) {
            const char = content[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\') {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    // 找到一个完整的 item
                    lastCompleteEnd = i;
                    completeItems++;
                }
            }
        }

        if (lastCompleteEnd === -1 || completeItems === 0) {
            return null;
        }

        // 计算被丢弃的 items 数量（粗略估计）
        const remaining = content.slice(lastCompleteEnd + 1);
        const incompleteItemStart = remaining.indexOf('{');
        const itemsDropped = incompleteItemStart !== -1 ? 1 : 0;

        // 重建 JSON：截取到最后一个完整 item，然后闭合
        // 注意：闭合时需要匹配开始时的 key (items 或 drills)
        // 其实 prefix 已经包含了 "key": [ ... ] 的前半部分，所以只需要闭合 ]}
        const prefix = content.slice(0, lastCompleteEnd + 1);
        const recovered = prefix + ']}';

        console.log('[DEBUG] recoverTruncatedJson success:', recovered);
        return { recovered, itemsDropped };
    } catch {
        return null;
    }
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
 * 支持从截断的 JSON 中恢复已完成的部分
 * 
 * @param content - AI 返回的原始文本
 * @param schema - Zod Schema 用于验证
 * @param context - 可选，用于错误日志的上下文信息
 */
export function safeParse<T>(content: string, schema: z.ZodSchema<T>, context?: ParseContext): T {
    const cleaned = repairJson(content);

    // 第一次尝试：直接解析
    try {
        const parsed = JSON.parse(cleaned);

        // 处理 AI 返回数组而非对象的情况
        if (Array.isArray(parsed)) {
            return schema.parse({ items: parsed });
        }

        return schema.parse(parsed);
    } catch (firstError) {
        // 第二次尝试：尝试恢复截断的 JSON
        const recovery = recoverTruncatedJson(cleaned);

        if (recovery && recovery.itemsDropped >= 0) {
            try {
                const parsed = JSON.parse(recovery.recovered);
                aiLogger.warn({ recoveredCount: parsed.items?.length || 0, dropped: recovery.itemsDropped }, `⚠️ JSON 截断恢复: 成功恢复 ${parsed.items?.length || 0} 个 items，丢弃 ${recovery.itemsDropped} 个不完整的`);

                if (Array.isArray(parsed)) {
                    return schema.parse({ items: parsed });
                }
                return schema.parse(parsed);
            } catch (recoveryError) {
                // 恢复也失败，记录原始错误
            }
        }

        // 所有尝试都失败，记录详细错误日志
        logAIError({
            error: firstError,
            systemPrompt: context?.systemPrompt,
            userPrompt: context?.userPrompt,
            rawResponse: content,
            model: context?.model,
            context: 'JSON 解析/验证失败',
        });

        // 抛出携带原始响应的错误，便于审计追溯
        const zodError = firstError instanceof z.ZodError ? firstError : undefined;
        throw new AIParseError(
            zodError?.message || String(firstError),
            content, // 原始 LLM 响应
            zodError
        );
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
