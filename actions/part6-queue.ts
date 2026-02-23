"use server";

import { fetchOMPSCandidates, OMPSCandidate } from "@/lib/services/omps-core";
import { buildArenaPart6Input, getPart6DrillBatchPrompt, Part6DrillInput } from "@/lib/generators/arena/part6-drill";
import { Part6OutputSchema, Part6Output } from "@/lib/generators/arena/part6-schema";
import { BriefingPayload, InteractionSegment } from "@/types/briefing";
import { ProviderRegistry } from "@/lib/ai/providers";
import { generateObject } from "ai";
import { auth } from "@/auth";

/**
 * Part 6 Session 生成入口 (Server Action)
 * 鉴权后自动从 Session 获取 userId，前端无需传入。
 */
export async function generatePart6Session(): Promise<BriefingPayload> {
    // [B1 Fix] 鉴权校验
    const session = await auth();
    if (!session?.user?.id) {
        return getStaticFallbackPayload();
    }
    const userId = session.user.id;

    const startTime = Date.now();
    let generationSource: 'llm_live' | 'redis_inventory' | 'static_fallback' = 'llm_live';

    try {
        // [Stage 1] Attempt to fetch from Pre-fetch Inventory (Redis)

        // [Stage 2] Live LLM Generation Fallback
        // 1. Fetch exactly 1 Target Word
        const candidates = await fetchOMPSCandidates(userId, 1, {}, [], 'ARENA_PART6');
        if (!candidates || candidates.length === 0) {
            throw new Error("OMPS failed to return a target word.");
        }
        const targetWord = candidates[0];

        // 2. Build Seed Input
        const inputData = await buildArenaPart6Input(targetWord);
        const promptParams = getPart6DrillBatchPrompt(inputData);

        // 3. Initialize High-Reasoning Model Client
        const aiProviders = ProviderRegistry.getFailoverList('smart');
        if (aiProviders.length === 0) {
            throw new Error("No AI providers configured for SMART generation.");
        }
        const aiClient = ProviderRegistry.createModel(aiProviders[0]);

        // 4. Call LLM with Zod Schema Validation
        const { object } = await generateObject({
            model: aiClient,
            schema: Part6OutputSchema,
            system: promptParams.system,
            prompt: promptParams.user,
            temperature: 0.7,
        });

        // 5. Assemble standard BriefingPayload
        const payload = assemblePart6Payload(object, targetWord, inputData, Date.now() - startTime, 'llm_live');
        return payload;

    } catch (error) {
        console.error("[Part 6 Generator] Live Generation failed, firing Fallback:", error);

        // [Stage 3] Static Fallback (Absolute Safety Net)
        return getStaticFallbackPayload();
    }
}

function assemblePart6Payload(
    output: Part6Output,
    targetWord: OMPSCandidate,
    inputData: Part6DrillInput,
    generationMs: number,
    source: 'llm_live' | 'redis_inventory' | 'static_fallback'
): BriefingPayload {

    const interactions: InteractionSegment[] = output.interactions.map((interactionRaw, index) => ({
        type: "interaction",
        dimension: interactionRaw.dimension,
        task: {
            style: "bubble_select",
            question_markdown: interactionRaw.task.question_markdown,
            options: interactionRaw.task.options.map(opt => ({
                id: Math.random().toString(36).substr(2, 9), // transient IDs
                text: opt.text,
                is_correct: opt.is_correct,
                type: opt.is_correct ? 'Correct' : 'Distractor',
                explanation_chunk: opt.explanation_markdown // specific to Part 6
            })),
            answer_key: interactionRaw.task.answer_key,
            explanation_markdown: interactionRaw.task.explanation_markdown
        }
    }));

    return {
        meta: {
            format: "part6",
            mode: "ARENA_PART6",
            batch_size: 4, // 1 passage, 4 questions
            sys_prompt_version: "v8.0",
            vocabId: targetWord.vocabId,
            target_word: targetWord.word,
            generation_ms: generationMs,
            source: source,
            seed_origin: inputData.seed.part === 6 ? 'part6_native' : 'part5_fallback',
            target_word_blank_index: output.target_word_blank_index,
        },
        passage_markdown: output.passage_markdown,
        segments: interactions // In Part 6, segments hold the 4 interactions directly
    };
}

function getStaticFallbackPayload(): BriefingPayload {
    // A robust, hardcoded business email with 4 interactions testing basic but essential TOEIC concepts.
    return {
        meta: {
            format: "part6",
            mode: "ARENA_PART6",
            batch_size: 4,
            sys_prompt_version: "static-fallback-v1",
            source: 'static_fallback',
            generation_ms: 0,
            target_word_blank_index: 2
        },
        passage_markdown: "Dear Team,\n\nPlease note that the server maintenance scheduled for tonight has been [__BLANK_1__]. We apologize for any [__BLANK_2__] this may cause. The IT department will [__BLANK_3__] you when the new schedule is confirmed. Thank you for your continued [__BLANK_4__].\n\nBest,\nIT Support",
        segments: [
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { text: "postponed", is_correct: true, type: "Correct" },
                        { text: "promoted", is_correct: false, type: "Distractor" },
                        { text: "predicted", is_correct: false, type: "Distractor" },
                        { text: "prevented", is_correct: false, type: "Distractor" }
                    ],
                    answer_key: "postponed",
                    explanation_markdown: "此处表示原定计划被'推迟'。"
                }
            },
            {
                type: "interaction",
                dimension: "X",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { text: "inconvenience", is_correct: true, type: "Correct" },
                        { text: "inconvenient", is_correct: false, type: "Distractor" },
                        { text: "inconveniently", is_correct: false, type: "Distractor" },
                        { text: "inconveniences", is_correct: false, type: "Distractor" }
                    ],
                    answer_key: "inconvenience",
                    explanation_markdown: "cause后接名词形式，表示'造成不便'。"
                }
            },
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { text: "notify", is_correct: true, type: "Correct" },
                        { text: "notice", is_correct: false, type: "Distractor" },
                        { text: "state", is_correct: false, type: "Distractor" },
                        { text: "remark", is_correct: false, type: "Distractor" }
                    ],
                    answer_key: "notify",
                    explanation_markdown: "notify sb. (通知某人) 为固定用法。"
                }
            },
            {
                type: "interaction",
                dimension: "V",
                task: {
                    style: "bubble_select",
                    question_markdown: "",
                    options: [
                        { text: "cooperation", is_correct: true, type: "Correct" },
                        { text: "collaboration", is_correct: false, type: "Distractor" },
                        { text: "coordination", is_correct: false, type: "Distractor" },
                        { text: "contribution", is_correct: false, type: "Distractor" }
                    ],
                    answer_key: "cooperation",
                    explanation_markdown: "thank you for your cooperation 是标准商务信函结语定式用法。"
                }
            }
        ] // End of segments
    };
}
