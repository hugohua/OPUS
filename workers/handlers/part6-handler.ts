import { AIService } from '@/lib/ai/core';
import { DrillCandidate } from '../types';
import { BriefingPayload } from '@/types/briefing';
import { logger as log } from '@/lib/logger';
import { getPart6DrillBatchPrompt, buildArenaPart6Input } from '@/lib/generators/arena/part6-drill';
import { Part6OutputSchema } from '@/lib/generators/arena/part6-schema';
import { buildArenaPart6FallbackDrill } from '@/lib/templates/arena-fallback';

export async function processArenaPart6Queue(
    candidates: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (candidates.length === 0) return;

    // Part 6 因耗时且体积大，并发度定为 1 (Chunk size = 1)
    const CHUNK_SIZE = 1;
    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
        const chunk = candidates.slice(i, i + CHUNK_SIZE);

        const llmInputs = await Promise.all(chunk.map(async (c) => {
            return {
                candidate: c,
                input: await buildArenaPart6Input(c as any)
            };
        }));

        const p = getPart6DrillBatchPrompt(llmInputs[0].input);

        try {
            const { object: rawPart6, provider } = await AIService.generateObject({
                mode: 'smart', // High reasoning requirement
                schema: Part6OutputSchema,
                system: p.system,
                prompt: p.user
            });

            // 转换 LLM Part6 Schema 为通用的 BriefingPayload 壳子（保留 passage_markdown 在 root 等）
            const transformedDrill = {
                meta: {
                    format: 'part6',
                    mode: 'ARENA_PART6',
                    target_word_blank_index: rawPart6.target_word_blank_index,
                    seed_origin: llmInputs[0].input.seed?.part === 6 ? 'part6_native' : 'part5_fallback',
                    questionSeedId: llmInputs[0].input.seed?.id, // [Fix] Ensure ID reaches frontend
                    questionType: llmInputs[0].input.seed?.questionType,
                    part: llmInputs[0].input.seed?.part ?? 6,
                },
                passage_markdown: rawPart6.passage_markdown,
                segments: rawPart6.interactions.map((interactionRaw: any) => ({
                    type: "interaction",
                    dimension: interactionRaw.dimension,
                    task: {
                        style: "bubble_select",
                        question_markdown: interactionRaw.task.question_markdown,
                        options: interactionRaw.task.options.map((opt: any) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            text: opt.text,
                            is_correct: opt.is_correct,
                            type: opt.is_correct ? 'Correct' : 'Distractor',
                            explanation_chunk: opt.explanation_markdown
                        })),
                        answer_key: interactionRaw.task.answer_key,
                        explanation_markdown: interactionRaw.task.explanation_markdown
                    }
                }))
            };

            generatedDrills.push({
                drill: transformedDrill,
                candidate: chunk[0],
                systemPrompt: p.system,
                userPrompt: p.user,
                provider: provider,
                // [V7.0/V8.0] 保留 seed 元数据用于遥测和 BKT 算分
                seedInfo: {
                    id: llmInputs[0].input.seed?.id,
                    questionType: llmInputs[0].input.seed?.questionType,
                    part: llmInputs[0].input.seed?.part ?? 6,
                }
            });
        } catch (err: any) {
            log.error({ error: err.message }, 'Failed to process Arena Part 6 chunk (LLM), using static fallback');

            // Fallback logic
            const targetWord = llmInputs[0].input.targetWord || chunk[0].word;
            generatedDrills.push({
                drill: await buildArenaPart6FallbackDrill(
                    targetWord,
                    llmInputs[0].input.seed?.id,
                    llmInputs[0].input.seed?.questionType ?? undefined,
                    llmInputs[0].input.seed?.part
                ),
                candidate: chunk[0],
                systemPrompt: 'PIVOT_FALLBACK',
                userPrompt: 'PIVOT_FALLBACK',
                provider: 'static_fallback',
                // [V7.0/V8.0] 保留 seed 元数据用于遥测和 BKT 算分
                seedInfo: {
                    id: llmInputs[0].input.seed?.id,
                    questionType: llmInputs[0].input.seed?.questionType,
                    part: llmInputs[0].input.seed?.part ?? 6,
                }
            });
        }
    }
}
