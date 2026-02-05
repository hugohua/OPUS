/**
 * Weaver Lab V2 API - FSRS 队列集成
 * 
 * 功能：
 *   基于 FSRS 队列自动选词，生成沉浸式商务阅读材料 (SSE 流式)
 * 
 * 端点: POST /api/weaver/v2/generate
 * 
 * 作者: Hugo
 * 日期: 2026-02-05
 */

import { z } from "zod";
import { auth } from "@/auth";
import { handleOpenAIStream, buildMessages } from "@/lib/streaming/sse";
import { WeaverV2InputSchema } from "@/lib/validations/weaver-wand-schemas";
import { fetchOMPSCandidates } from "@/lib/services/omps-core";
import { recordOutcome } from "@/actions/record-outcome";
import { prisma } from "@/lib/db";
import {
    buildWeaverContextSystemPrompt,
    buildWeaverContextUserPrompt
} from "@/lib/generators/l2/weaver-context";

export const maxDuration = 30;

/**
 * POST /api/weaver/v2/generate
 * 
 * 核心逻辑：
 * 1. 校验用户认证
 * 2. 如果未指定 target_word_ids，调用 OMPS 自动装填
 * 3. 生成 LLM Prompt (基于 Scenario)
 * 4. 流式返回生成的文章
 * 5. [W3 Fix] onComplete 中记录 L2 Track Context Exposure
 */
export async function POST(req: Request) {
    try {
        // ✅ Auth 校验
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        // ✅ Zod 校验
        const json = await req.json();
        const { scenario, target_word_ids } = WeaverV2InputSchema.parse(json);

        const userId = session.user.id;

        // ✅ [WL-01] 智能装填：OMPS 自动选词 or 手动指定
        let candidates;

        if (target_word_ids && target_word_ids.length > 0) {
            // 手动指定模式
            const manualRaw = await prisma.vocab.findMany({
                where: { id: { in: target_word_ids } },
                select: {
                    id: true,
                    word: true,
                    definition_cn: true
                }
            });
            candidates = manualRaw.map(c => ({
                id: c.id,
                word: c.word,
                definition_cn: c.definition_cn || ""
            }));
        } else {
            // 自动装填模式：调用 OMPS (70% Due + 30% New)
            const raw = await fetchOMPSCandidates(
                userId,
                12, // 目标词数量：8-12 个
                { reviewRatio: 0.7 }, // Priority Words (Due)
                [], // no excludes
                "CONTEXT" // L2 Track
            );

            candidates = raw.map(c => ({
                id: c.vocabId,
                word: c.word,
                definition_cn: c.definition_cn || "" // ✅ Fix: 处理 null 类型
            }));
        }

        if (candidates.length === 0) {
            return new Response(
                JSON.stringify({ error: "No target words available" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // ✅ [WL-02] 构建 Scenario-Driven Prompt (使用 Generator)
        const systemPrompt = buildWeaverContextSystemPrompt(scenario);
        const userPrompt = buildWeaverContextUserPrompt({
            targetWords: candidates,
            scenario
        });

        const messages = buildMessages(userPrompt, systemPrompt);

        // ✅ [WL-03] 流式生成 (SSE)
        return handleOpenAIStream(messages, {
            model: process.env.QWEN_MODEL_NAME || "qwen-plus",
            temperature: 0.7,
            errorContext: "WeaverLab V2 Generation",

            // ✅ [W3 Fix] 完成后记录 L2 Context Exposure
            onComplete: async (text) => {
                console.log(`[WeaverV2] Generated article for scenario=${scenario} (${text.length} chars)`);

                // 为每个目标词记录「语境曝光」
                await Promise.all(candidates.map(c =>
                    recordOutcome({
                        userId,
                        vocabId: c.id,
                        grade: 1, // ✅ Fix: 使用 grade=1 (Again) 表示 Exposure
                        mode: "CONTEXT", // L2 Track
                        track: "CONTEXT"
                    }).catch(err => {
                        console.error(`[WeaverV2] Failed to record exposure for vocab ${c.id}:`, err);
                    })
                ));

                // TODO: 添加审计埋点 (Phase 4)
                // await auditLog('WEAVER_SELECTION', { userId, scenario, wordIds: candidates.map(c => c.id) });
            }
        });

    } catch (error) {
        console.error("[WeaverV2] Request Error:", error);

        if (error instanceof z.ZodError) {
            return new Response(JSON.stringify({
                error: "Invalid input",
                details: error.issues // ✅ Fix: 使用 issues 替代 errors
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
