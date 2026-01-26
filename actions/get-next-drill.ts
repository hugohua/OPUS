'use server';

import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { GetBriefingSchema, GetBriefingInput } from '@/lib/validations/briefing';
import { inventory } from '@/lib/inventory';
import { buildSimpleDrill } from '@/lib/templates/deterministic-drill';
import { buildPhraseDrill } from '@/lib/templates/phrase-drill';

const log = createLogger('actions:get-next-drill');

// --- Helper Types ---
interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    word_family: any;
    priority_level: number;
    frequency_score: number;
    commonExample: string | null;
}

// --- Main Action ---
export async function getNextDrillBatch(
    input: GetBriefingInput
): Promise<ActionState<BriefingPayload[]>> {
    try {
        // 1. Validate Input
        const validated = GetBriefingSchema.parse(input);
        const { userId, mode, limit: inputLimit, excludeVocabIds } = validated;

        // Effective limit logic (usually 10)
        const effectiveLimit = inputLimit || 10;

        log.info({ userId, mode, limit: effectiveLimit }, 'Fetching drill batch (V2 Schedule-Driven)');

        // ============================================
        // Schedule-Driven Protocol (V2.0)
        // ============================================

        // Step 1: Scheduling (Ask FSRS "Who?")
        // Fetch candidates based on SRS rules (Rescue -> Review -> Acquisition)
        const candidates = await fetchCandidates(userId, effectiveLimit, mode, excludeVocabIds);

        if (candidates.length === 0) {
            return {
                status: 'success',
                message: 'No candidates found',
                data: [],
            };
        }

        // Step 2: Consumption (Ask Redis "Content?")
        const drills: BriefingPayload[] = [];
        const missedVocabIds: number[] = [];

        for (const candidate of candidates) {
            let drill: BriefingPayload | null = null;
            let source = 'unknown';

            // 2.1 Fast Path for STATIC content (e.g. PHRASE)
            if (mode === 'PHRASE') {
                const phraseDrill = buildPhraseDrill(candidate as any); // Cast to Vocab (subset)
                if (phraseDrill) {
                    drill = phraseDrill;
                    source = 'fast_path_db';
                }
            } else {
                // 2.2 Standard Path: Try Pop from Inventory
                try {
                    drill = await inventory.popDrill(userId, mode, candidate.vocabId);
                    if (drill) source = 'cache_v2';
                } catch (e) {
                    log.error({ error: e, candidate }, 'Redis pop failed');
                }
            }

            // 2.2 Handle Miss (Plan A + Plan B/C)
            if (!drill) {
                // Plan A: Zero-Wait Deterministic Fallback
                drill = buildSimpleDrill({
                    id: candidate.vocabId,
                    word: candidate.word,
                    definition_cn: candidate.definition_cn,
                    commonExample: candidate.commonExample
                }, mode);
                source = 'deterministic_fallback';

                // Collect for Plan B (Batch Emergency)
                missedVocabIds.push(candidate.vocabId);
            }

            // Append metadata
            if (drill) {
                drill.meta = {
                    ...drill.meta,
                    source,
                    vocabId: candidate.vocabId // Ensure vocabId is tracked
                };
                drills.push(drill);
            }
        }

        // Fire Batch Emergency if needed (Request-Level Aggregation)
        if (missedVocabIds.length > 0) {
            inventory.triggerBatchEmergency(userId, mode, missedVocabIds).catch(err => {
                log.warn({ error: err.message, count: missedVocabIds.length }, 'Batch Emergency trigger failed');
            });
        }

        return {
            status: 'success',
            message: `Batch retrieved (Sources: ${drills.map(d => (d.meta as any).source).join(', ')})`,
            data: drills,
            meta: {
                count: drills.length
            }
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

// --- Scheduling Logic (Reused & Optimized) ---

async function fetchCandidates(
    userId: string,
    limit: number,
    mode: SessionMode,
    excludeIds: number[]
): Promise<DrillCandidate[]> {
    const rescueLimit = Math.ceil(limit * 0.3); // 30% Rescue
    const reviewLimit = Math.ceil(limit * 0.5); // 50% Review

    const excludeFilter = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};

    // Parallel fetch for Rescue & Review
    const [rescueRaw, reviewRaw] = await Promise.all([
        prisma.userProgress.findMany({
            where: {
                userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                dim_v_score: { lt: 30 }, // Syntax weak
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
                next_review_at: { lte: new Date() }, // Due items
                dim_v_score: { gte: 30 },
                vocab: { ...excludeFilter }
            },
            take: reviewLimit * 2, // Fetch extra for buffering
            orderBy: { next_review_at: 'asc' },
            include: { vocab: true }
        })
    ]);

    const rescue = rescueRaw.map(x => mapToCandidate(x.vocab, 1));
    const review = reviewRaw.map(x => mapToCandidate(x.vocab, 2));

    let final: DrillCandidate[] = [];
    final.push(...rescue);

    // Calculate slots for New Words
    const guaranteedNew = Math.floor(limit * 0.2); // 20% New
    const slotsForReview = Math.max(0, limit - final.length - guaranteedNew);

    if (slotsForReview > 0) {
        final.push(...review.slice(0, slotsForReview));
    }

    // Fetch New Words (Acquisition)
    const slotsRemaining = limit - final.length;

    if (slotsRemaining > 0) {
        let posFilter: string[] | undefined;
        if (mode === 'SYNTAX') posFilter = ['v', 'n', 'v.', 'n.', 'vi', 'vt', 'vi.', 'vt.', 'noun', 'verb', '名詞', '動詞'];

        const newWordsRaw = await prisma.vocab.findMany({
            where: {
                progress: { none: { userId } },
                ...excludeFilter,
                ...(posFilter ? { partOfSpeech: { in: posFilter } } : {}),
                OR: [
                    { abceed_level: { lte: 1 } },
                    { is_toeic_core: true }
                ]
            },
            orderBy: { frequency_score: 'desc' },
            take: slotsRemaining,
        });

        const newWords = newWordsRaw.map(x => mapToCandidate(x, 3));
        final.push(...newWords);
    }

    // Fill remaining slots with Review if New Words ran out
    if (final.length < limit && review.length > slotsForReview) {
        const extraReview = review.slice(slotsForReview, slotsForReview + (limit - final.length));
        final.push(...extraReview);
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
        frequency_score: v.frequency_score,
        commonExample: v.commonExample
    };
}
