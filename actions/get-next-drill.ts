'use server';

import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { GetBriefingSchema, GetBriefingInput } from '@/lib/validations/briefing';
import { getDrillBatchPrompt } from '@/lib/prompts/drill';
import { getAIModel } from '@/lib/ai/client';

import { generateObject, generateText } from 'ai';
import { findCachedDrill, markDrillConsumed } from '@/lib/drill-cache';

const log = createLogger('actions:get-next-drill');

// --- AI Output Schema ---
const DrillSegmentSchema = z.object({
    type: z.enum(['text', 'interaction']),
    content_markdown: z.string().optional(),
    audio_text: z.string().optional(),
    dimension: z.string().optional(),
    task: z.object({
        style: z.enum(['swipe_card', 'bubble_select']),
        question_markdown: z.string(),
        options: z.array(z.string()),
        answer_key: z.string(),
        explanation_markdown: z.string().optional(),
    }).optional(),
});

const SingleDrillSchema = z.object({
    meta: z.object({
        format: z.enum(['chat', 'email', 'memo']),
        mode: z.enum(['SYNTAX', 'CHUNKING', 'NUANCE']),
        target_word: z.string().optional(),
    }),
    segments: z.array(DrillSegmentSchema),
});

const BatchDrillOutputSchema = z.object({
    drills: z.array(SingleDrillSchema),
});

// --- Constants ---
const BATCH_SIZE_MAP: Record<SessionMode, number> = {
    SYNTAX: 20,
    CHUNKING: 30,
    NUANCE: 50,
};

// --- Main Action ---
export async function getNextDrillBatch(
    input: GetBriefingInput
): Promise<ActionState<BriefingPayload[]>> {
    try {
        // 1. Validate Input
        const validated = GetBriefingSchema.parse(input);
        const { userId, mode, limit: inputLimit, excludeVocabIds, forceRefresh } = validated;
        // Use input limit if provided (pagination), otherwise fallback to batch size (legacy/full)
        // Actually, schema now defaults limit to 10. We should respect it if it's explicitly passed for lazy loading.
        // But for initial load? The user requirement says "First generate 10... then load more".
        // So we will respect the inputLimit.
        const effectiveLimit = inputLimit;

        log.info({ userId, mode, limit: effectiveLimit, excludedCount: excludeVocabIds.length }, 'Fetching drill batch');

        // 0. Cache Check (Optimization)
        // If we have a cached batch, return it immediately!
        if (effectiveLimit >= 10 && !forceRefresh) { // Only use cache for full batches, not micro-fetches
            const cached = await findCachedDrill(userId, mode);
            if (cached) {
                log.info({ cacheId: cached.id }, 'Cache Hit! Returning pre-generated drill.');

                // Mark as consumed (async, don't block return? No, for consistency we await)
                await markDrillConsumed(cached.id);

                return {
                    status: 'success',
                    message: 'Batch retrieved from cache',
                    data: cached.payload as unknown as BriefingPayload[],
                };
            }
        }

        log.info('Cache Miss. Proceeding to real-time generation.');

        // 2. Fetch Candidates (30/50/20 Protocol)
        const candidates = await fetchCandidates(userId, effectiveLimit, mode, excludeVocabIds);

        if (candidates.length === 0) {
            return { status: 'error', message: 'No vocab candidates found.' };
        }

        // 3. Enrich Context (1+N Rule) & Format Prompt Inputs
        const promptInputs = await Promise.all(
            candidates.map(async (c) => {
                const contextWords = await getContextWords(c.word);
                return {
                    targetWord: c.word,
                    meaning: c.definition_cn || '暂无释义',
                    contextWords,
                    wordFamily: (c.word_family as Record<string, string>) || { v: c.word },
                };
            })
        );

        // 4. Generate Content via AI
        const { system, user } = getDrillBatchPrompt(promptInputs);

        const { model } = getAIModel('default');

        // Use generateText for more robustness with potential markdown wrapping
        const { text } = await generateText({
            model,
            system,
            prompt: user,
        });

        // Clean markdown code blocks if present
        const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();

        let parsedData;
        try {
            parsedData = JSON.parse(cleanJson);
        } catch (e) {
            log.error({ text }, 'Failed to parse AI JSON response');
            throw new Error('AI response was not valid JSON');
        }

        // Enforce the requested mode to prevent validation errors if AI hallucinates/mixes case
        if (parsedData && Array.isArray(parsedData.drills)) {
            parsedData.drills.forEach((d: any) => {
                if (d.meta) {
                    d.meta.mode = mode;
                }
            });
        }

        // Validate structure
        const result = BatchDrillOutputSchema.safeParse(parsedData);
        if (!result.success) {
            log.error({ errors: result.error }, 'AI response schema validation failed');
            throw new Error('AI response did not match schema');
        }

        log.info({ count: result.data.drills.length }, 'AI generation complete');

        // 5. Transform/Hydrate Output
        const payload: BriefingPayload[] = result.data.drills.map((drill, idx) => {
            const targetStr = drill.meta.target_word;
            const candidate = targetStr ? candidates.find(c => c.word === targetStr) : candidates[idx];
            const safeCandidate = candidate || candidates[idx];

            return {
                meta: {
                    format: drill.meta.format as any,
                    mode: mode, // Redundant but safe
                    batch_size: effectiveLimit,
                    sys_prompt_version: 'v2.7',
                    vocabId: safeCandidate?.vocabId, // safely access
                    target_word: safeCandidate?.word,
                },
                segments: drill.segments as any[],
            };
        });

        return {
            status: 'success',
            message: 'Batch generated successfully',
            data: payload,
        };

    } catch (error: any) {
        log.error({ error }, 'getNextDrillBatch failed');
        return {
            status: 'error',
            message: error.message || 'Failed to generate drill batch',
            fieldErrors: {},
        };
    }
}

// --- Helpers ---

interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    word_family: any;
    priority_level: number;
    frequency_score: number;
}

async function fetchCandidates(
    userId: string,
    limit: number,
    mode: SessionMode,
    excludeIds: number[]
): Promise<DrillCandidate[]> {
    const rescueLimit = Math.ceil(limit * 0.3);
    const reviewLimit = Math.ceil(limit * 0.5);
    // newLimit is not explicitly used in query logic below but useful for mental model
    // const newLimit = limit - rescueLimit - reviewLimit; 

    // Common exclusion filter
    const excludeFilter = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};

    const [rescueRaw, reviewRaw] = await Promise.all([
        prisma.userProgress.findMany({
            where: {
                userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                dim_v_score: { lt: 30 },
                vocab: { ...excludeFilter }
            },
            take: rescueLimit,
            orderBy: { next_review_at: 'asc' },
            include: { vocab: true }
        }),
        prisma.userProgress.findMany({
            where: {
                userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                next_review_at: { lte: new Date() },
                dim_v_score: { gte: 30 },
                vocab: { ...excludeFilter }
            },
            take: reviewLimit * 2,
            orderBy: { next_review_at: 'asc' },
            include: { vocab: true }
        })
    ]);

    const rescue = rescueRaw.map(x => mapToCandidate(x.vocab, 1));
    const review = reviewRaw.map(x => mapToCandidate(x.vocab, 2));

    let final: DrillCandidate[] = [];
    final.push(...rescue);

    const guaranteedNew = Math.floor(limit * 0.2);
    // Ensure we don't take negative slots if rescue filled everything (unlikely with 0.3 limit but possible if logical bugs)
    // review slots = (limit - rescue) - guaranteedNew.
    // e.g. 20 - 6 - 4 = 10.
    const slotsForReviewCorrect = Math.max(0, limit - final.length - guaranteedNew);

    if (slotsForReviewCorrect > 0) {
        final.push(...review.slice(0, slotsForReviewCorrect));
    }

    let posFilter: string[] | undefined;
    if (mode === 'SYNTAX') posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞'];

    const newWordsRaw = await prisma.vocab.findMany({
        where: {
            progress: { none: { userId } },
            ...excludeFilter, // Apply exclusion to new words too
            ...(posFilter ? { partOfSpeech: { in: posFilter } } : {}),
            OR: [
                { abceed_level: { lte: 1 } },
                { is_toeic_core: true }
            ]
        },
        orderBy: [
            { frequency_score: 'desc' }
        ],
        take: limit,
    });

    const newWords = newWordsRaw.map(x => mapToCandidate(x, 3));

    const slotsRemaining = limit - final.length;
    if (slotsRemaining > 0) {
        final.push(...newWords.slice(0, slotsRemaining));
    }

    if (final.length < limit && review.length > slotsForReviewCorrect) {
        const moreReview = review.slice(slotsForReviewCorrect, slotsForReviewCorrect + (limit - final.length));
        final.push(...moreReview);
    }

    return final;
}

function mapToCandidate(v: any, priority: number): DrillCandidate {
    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        word_family: v.word_family,
        priority_level: priority,
        frequency_score: v.frequency_score
    };
}

async function getContextWords(targetWord: string): Promise<string[]> {
    const candidates = await prisma.$queryRaw<Array<{ word: string }>>`
        SELECT word 
        FROM "Vocab"
        WHERE word != ${targetWord}
          AND CHAR_LENGTH(word) > 3
          AND (
            word_family->>'n' IS NOT NULL 
            OR word_family->>'adj' IS NOT NULL
          )
        ORDER BY RANDOM()
        LIMIT 3;
    `;
    return candidates.map(c => c.word);
}
