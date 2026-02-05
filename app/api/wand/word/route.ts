/**
 * Magic Wand 查词 API - Cache-First 策略
 * 
 * 功能：
 *   即时查词 (本地词源 + 异步 AI 解析)
 * 
 * 端点: GET /api/wand/word
 * 查询参数:
 *   - word: 查询的单词 (必填)
 *   - context_id: 上下文 ID (可选，用于 AI 语境解析)
 * 
 * 数据策略: Cache-First, AI-Fallback
 *   - 第一层 (< 50ms): 本地 `Etymology` 表
 *   - 第二层 (异步): LLM 语境解析 (前端通过 SSE 获取)
 * 
 * 作者: Hugo
 * 日期: 2026-02-05
 */

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
    WandWordQuerySchema,
    WandWordOutputSchema,
    type WandWordOutput
} from "@/lib/validations/weaver-wand-schemas";
import { auditWandLookup } from "@/lib/services/audit-service";

/**
 * GET /api/wand/word
 * 
 * 核心逻辑：
 * 1. ✅ [W1 Fix] 强制 Auth 校验
 * 2. 从本地数据库查询词汇 + 词源信息
 * 3. 立即返回 (Cache-First)
 * 4. ai_insight 初始为 null (前端异步获取)
 */
export async function GET(req: Request) {
    try {
        // ✅ [W1 Fix] Auth 校验
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        // ✅ 解析查询参数
        const url = new URL(req.url);
        const queryParams = {
            word: url.searchParams.get("word"),
            context_id: url.searchParams.get("context_id") || undefined
        };

        // ✅ Zod 校验
        const { word, context_id } = WandWordQuerySchema.parse(queryParams);

        // ✅ [MW-01 + MW-02] 第一层: 本地缓存 (< 50ms)
        const vocab = await prisma.vocab.findFirst({
            where: {
                word: {
                    equals: word,
                    mode: 'insensitive' // 大小写不敏感
                }
            },
            select: {
                id: true,
                word: true,
                phoneticUk: true,
                definition_cn: true,
                etymology: {
                    select: {
                        mode: true,
                        memory_hook: true,
                        data: true
                    }
                }
            }
        });

        if (!vocab) {
            return new Response(
                JSON.stringify({ error: "Word not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // ✅ 构建响应 (符合 WandWordOutputSchema)
        const response: WandWordOutput = {
            vocab: {
                phonetic: vocab.phoneticUk || "",
                meaning: vocab.definition_cn || ""
            },
            etymology: vocab.etymology ? {
                mode: vocab.etymology.mode,
                memory_hook: vocab.etymology.memory_hook,
                data: vocab.etymology.data as Record<string, any>
            } : null,
            ai_insight: null // 初始为 null，前端通过 SSE 异步获取
        };

        // ✅ Schema 校验 (确保输出符合规范)
        WandWordOutputSchema.parse(response);

        // TODO: 如果有 context_id，启动后台 AI 解析任务 (Phase 3)
        // if (context_id) {
        //     await queueAIInsightJob({ vocabId: vocab.id, contextId: context_id });
        // }

        // ✅ [Audit] 添加审计埋点 (Phase 4)
        auditWandLookup(session.user.id, word, context_id, {
            vocabId: vocab.id,
            found: true
        });

        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: { "Content-Type": "application/json" }
            }
        );

    } catch (error) {
        console.error("[MagicWand] Request Error:", error);

        if (error instanceof z.ZodError) {
            return new Response(JSON.stringify({
                error: "Invalid query parameters",
                details: error.flatten() // Fix logic
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
