import { AIService } from '@/lib/ai/core';
import { DrillCandidate, BatchDrillOutputSchema } from '../types';
import { logger as log } from '@/lib/logger';
import { getPart5DrillBatchPrompt, buildArenaPart5Inputs } from '@/lib/generators/arena/part5-drill';
import { buildWeightedTypePicker, getWeakestGrammarNodesRaw } from '@/lib/services/diagnostic-service';

export async function processArenaPart5Queue(
    userId: string,
    candidates: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (candidates.length === 0) return;

    // [V7.0] 漏斗第一层：宏观大题型调度引擎 (基于历史错误率加权)
    const pickTypeFn = await buildWeightedTypePicker(userId);
    // [V7.0] 漏斗第二层：微观语法结构追踪引擎 (BKT 筛选弹药库)
    const weakNodeIds = await getWeakestGrammarNodesRaw(userId, 5); // 提取最薄弱的 5 个语法树节点

    const directPivotDrills: any[] = [];
    const realCandidates: DrillCandidate[] = [];

    // 区分来源于 OMPS 真实词库的 candidate 和纯语法的假 candidate
    for (const c of candidates) {
        if (c.vocabId < 0 && c.reviewData?.seed) {
            directPivotDrills.push({ candidate: c, seed: c.reviewData.seed });
        } else {
            realCandidates.push(c);
        }
    }

    // 一键处理真词候选项的 DB 查询与 Seed 重组，注入双漏斗引擎选型参数
    let llmInputs: { candidate: any; input: any }[] = [];
    if (realCandidates.length > 0) {
        llmInputs = await buildArenaPart5Inputs(realCandidates, pickTypeFn, weakNodeIds);
    }

    // 3. 执行 LLM 生成 (分批处理，每次 2 词，防 API 限流与 LLM 串线)
    if (llmInputs.length > 0) {
        const CHUNK_SIZE = 2;
        for (let i = 0; i < llmInputs.length; i += CHUNK_SIZE) {
            const chunk = llmInputs.slice(i, i + CHUNK_SIZE);
            const p = getPart5DrillBatchPrompt(chunk.map(item => item.input));

            try {
                const { object: result, provider } = await AIService.generateObject({
                    mode: 'fast',
                    schema: BatchDrillOutputSchema,
                    system: p.system,
                    prompt: p.user
                });

                result.items.forEach((drill: any, idx: number) => {
                    if (idx < chunk.length) {
                        generatedDrills.push({
                            drill,
                            candidate: chunk[idx].candidate,
                            systemPrompt: p.system,
                            userPrompt: p.user,
                            provider: provider,
                            // [V7.0] 保留 seed 元数据用于遥测
                            seedInfo: {
                                id: chunk[idx].input.seed?.id,
                                questionType: chunk[idx].input.seed?.questionType,
                                part: chunk[idx].input.seed?.part ?? 5,
                            }
                        });
                    }
                });
            } catch (err: any) {
                log.error({ error: err.message, chunkIndex: i / CHUNK_SIZE }, 'Failed to process Arena Part 5 chunk (LLM), using raw seeds as fallback');
                // Fallback: Use the raw seeds directly for this specific failed chunk
                for (const item of chunk) {
                    directPivotDrills.push({ candidate: item.candidate, seed: item.input.seed });
                }
            }
        }
    }

    // 4. 处理直接兜底（纯语法题 或 LLM 失败项）
    for (const pivot of directPivotDrills) {
        const seed = pivot.seed;
        // 组装 BriefingPayload 结构
        const fallbackDrill = {
            meta: {
                mode: 'ARENA_PART5',
                target_word: pivot.candidate.word || seed.targetAnswer,
            },
            segments: [
                {
                    type: 'text',
                    content_markdown: seed.sentence.replace('_______', seed.targetAnswer), // Full sentence
                },
                {
                    type: 'interaction',
                    dimension: 'V', // Visual track default
                    task: {
                        style: 'swipe_card',
                        question_markdown: seed.sentence,
                        options: seed.options,
                        answer_key: seed.targetAnswer,
                        explanation_markdown: seed.rationale || '正确选项符合该句的语法及语境要求。' // Might be missing in some raw DB
                    }
                }
            ]
        };

        generatedDrills.push({
            drill: fallbackDrill,
            candidate: pivot.candidate,
            systemPrompt: 'PIVOT_FALLBACK',
            userPrompt: 'PIVOT_FALLBACK',
            provider: 'db_seed_fallback'
        });
    }
}
