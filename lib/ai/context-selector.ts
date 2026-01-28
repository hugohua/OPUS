// ⚠️ FOR CONTEXT GENERATION ONLY. DO NOT USE FOR MULTIPLE CHOICE DISTRACTORS.

import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { Vocab } from '@prisma/client';
import { Prisma } from '@prisma/client';

const log = createLogger('context-selector');

export type ContextStrategy = 'USER_VECTOR' | 'GLOBAL_VECTOR' | 'TAG' | 'RANDOM';

export interface ContextSelectorOptions {
    /**
     * Number of context words needed (The "N" in "1+N")
     * Default: 3
     */
    count?: number;

    /**
     * Strategies to use in order of priority (Waterfall)
     * Default: ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'] (Offline/Worker default)
     */
    strategies?: ContextStrategy[];

    /**
     * Minimum Cosine Distance (Goldilocks Zone Lower Bound)
     * Filter out synonyms that are too close (e.g. < 0.15) to avoid redundant sentences.
     * Default: 0.15
     */
    minDistance?: number;

    /**
     * Maximum Cosine Distance (Goldilocks Zone Upper Bound)
     * Filter out words that are too far and irrelevant (e.g. > 0.5).
     * Default: 0.5
     */
    maxDistance?: number;

    /**
     * IDs to exclude (e.g. target word itself, or already selected words)
     */
    excludeIds?: number[];
}

/**
 * 1+N Context Selection Capability
 * 
 * Purpose: Select "N" context words to support the "1" target word in sentence/article generation.
 * Logic: Waterfall Hybrid Strategy (User Vector -> Global Vector -> Fallback).
 * 
 * STRICTLY FOR GENERATION (L2), NOT FOR DISTRACTORS (L0/L1).
 */
export class ContextSelector {

    /**
     * Main Entry Point: Select Context Words
     */
    static async select(
        userId: string,
        targetVocabId: number,
        options: ContextSelectorOptions = {}
    ): Promise<Vocab[]> {
        const {
            count = 3,
            strategies = ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'], // Default full pipeline
            minDistance = 0.15,
            maxDistance = 0.5,
            excludeIds = []
        } = options;

        // 1. Check if target exists and has embedding (via raw query for embedding check)
        // Prisma Client cannot select 'vector' type directly.
        const targetWordMeta = await prisma.vocab.findUnique({
            where: { id: targetVocabId },
            select: { id: true, word: true, scenarios: true }
        });

        if (!targetWordMeta) {
            log.warn({ targetVocabId }, 'Target word not found');
            return [];
        }

        // Check embedding existence
        const embeddingCheck = await prisma.$queryRaw<{ has_embedding: boolean }[]>`
            SELECT (embedding IS NOT NULL) as has_embedding FROM "Vocab" WHERE id = ${targetVocabId}
        `;
        const hasEmbedding = embeddingCheck[0]?.has_embedding;

        // ...

        const targetWord = { ...targetWordMeta, embedding: hasEmbedding ? true : null }; // Mock property for logic flow

        const selected: Vocab[] = [];
        const currentExclude = new Set<number>([targetVocabId, ...excludeIds]);

        // Helper to check how many more we need
        const needed = () => count - selected.length;

        for (const strategy of strategies) {
            if (needed() <= 0) break;

            const remainingCount = needed();
            let newItems: Vocab[] = [];

            try {
                switch (strategy) {
                    case 'USER_VECTOR':
                        // Only runs if target has embedding
                        if (targetWord.embedding) {
                            // Attempt 1: Goldilocks Zone
                            newItems = await this.selectByUserVector(
                                userId, targetWord, remainingCount, Array.from(currentExclude),
                                minDistance, maxDistance
                            );

                            // Attempt 2: Elastic Relaxation (If not enough)
                            // Widen range: 0.10 to 0.70
                            if (newItems.length < remainingCount) {
                                const relaxedItems = await this.selectByUserVector(
                                    userId, targetWord, remainingCount - newItems.length,
                                    Array.from(currentExclude).concat(newItems.map(i => i.id)),
                                    0.10, 0.70
                                );
                                newItems = [...newItems, ...relaxedItems];
                            }
                        }
                        break;

                    case 'GLOBAL_VECTOR':
                        if (targetWord.embedding) {
                            // Attempt 1: Goldilocks Zone
                            newItems = await this.selectByGlobalVector(
                                targetWord, remainingCount, Array.from(currentExclude),
                                minDistance, maxDistance
                            );

                            // Attempt 2: Elastic Relaxation (If not enough)
                            if (newItems.length < remainingCount) {
                                const relaxedItems = await this.selectByGlobalVector(
                                    targetWord, remainingCount - newItems.length,
                                    Array.from(currentExclude).concat(newItems.map(i => i.id)),
                                    0.10, 0.70
                                );
                                newItems = [...newItems, ...relaxedItems];
                            }
                        }
                        break;

                    case 'TAG':
                        newItems = await this.selectByTag(
                            userId, targetWord, remainingCount, Array.from(currentExclude)
                        );
                        break;

                    case 'RANDOM':
                        newItems = await this.selectByRandom(
                            targetWord, remainingCount, Array.from(currentExclude)
                        );
                        break;
                }
            } catch (error) {
                log.error({ strategy, error: String(error) }, 'Strategy execution failed, skipping');
            }

            if (newItems.length > 0) {
                log.info({ strategy, count: newItems.length, words: newItems.map(w => w.word) }, 'Context words found via strategy');
                for (const item of newItems) {
                    if (!currentExclude.has(item.id)) {
                        selected.push(item);
                        currentExclude.add(item.id);
                    }
                }
            }
        }

        return selected;
    }

    // --- Strategy Implementations ---

    /**
     * Strategy A: User Review Queue (Vector)
     * "Interleaved Practice" - Reinforce known words.
     */
    private static async selectByUserVector(
        userId: string,
        target: { id: number },
        limit: number,
        exclude: number[],
        minDist: number,
        maxDist: number
    ): Promise<Vocab[]> {
        // Construct exclusion clause
        const excludeClause = exclude.length > 0
            ? Prisma.sql`AND v.id NOT IN (${Prisma.join(exclude)})`
            : Prisma.empty;

        // Query with Goldilocks Zone
        // [Fix] Select explicit columns to avoid 'Unsupported("vector")' decode error
        const cols = Prisma.sql`v.id, v.word, v.definition_cn, v.scenarios, v.frequency_score, v.abceed_level`;

        return prisma.$queryRaw<Vocab[]>`
            SELECT ${cols}
            FROM "UserProgress" up
            JOIN "Vocab" v ON up."vocabId" = v.id
            WHERE up."userId" = ${userId}
              AND up.status IN ('LEARNING', 'REVIEW')
              AND v.embedding IS NOT NULL
              ${excludeClause}
              AND (v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id})) > ${minDist}
              AND (v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id})) < ${maxDist}
            ORDER BY v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id}) ASC
            LIMIT ${limit};
        `;
    }

    /**
     * Strategy B: Global Vocab (Vector)
     * "Context Completion" - Fill gaps with semantically relevant words.
     */
    private static async selectByGlobalVector(
        target: { id: number },
        limit: number,
        exclude: number[],
        minDist: number,
        maxDist: number
    ): Promise<Vocab[]> {
        const excludeClause = exclude.length > 0
            ? Prisma.sql`AND id NOT IN (${Prisma.join(exclude)})`
            : Prisma.empty;

        const cols = Prisma.sql`id, word, definition_cn, scenarios, frequency_score, abceed_level`;

        return prisma.$queryRaw<Vocab[]>`
            SELECT ${cols}
            FROM "Vocab"
            WHERE embedding IS NOT NULL
              ${excludeClause}
              AND (embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id})) > ${minDist}
              AND (embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id})) < ${maxDist}
            ORDER BY embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${target.id}) ASC
            LIMIT ${limit};
        `;
    }

    /**
     * Strategy C: Tag Matching (Legacy / Fast)
     */
    private static async selectByTag(
        userId: string,
        target: { id: number, scenarios: string[] },
        limit: number,
        exclude: number[]
    ): Promise<Vocab[]> {
        if (target.scenarios.length === 0) return [];

        // Note: This logic mimics the old WordSelectionService
        // Find user learning words that share scenarios
        const items = await prisma.userProgress.findMany({
            where: {
                userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                vocabId: { notIn: exclude },
                vocab: {
                    scenarios: { hasSome: target.scenarios }
                }
            },
            include: { vocab: true },
            take: limit,
            // Randomize or order by due date (using due date here for interleaving)
            orderBy: { dueDate: 'asc' }
        });

        return items.map(p => p.vocab);
    }

    /**
     * Strategy D: Random Fallback (Noise)
     * "System Safety" - Prevent crash if no data.
     */
    private static async selectByRandom(
        target: { id: number, word: string },
        limit: number,
        exclude: number[]
    ): Promise<Vocab[]> {
        const excludeClause = exclude.length > 0
            ? Prisma.sql`AND id NOT IN (${Prisma.join(exclude)})`
            : Prisma.empty;

        const cols = Prisma.sql`id, word, definition_cn, scenarios, frequency_score, abceed_level`;

        // Use array<any> because $queryRaw returns objects
        return prisma.$queryRaw<Vocab[]>`
            SELECT ${cols}
            FROM "Vocab"
            WHERE word != ${target.word}
              AND CHAR_LENGTH(word) > 3
              ${excludeClause} 
            ORDER BY RANDOM()
            LIMIT ${limit};
        `;
    }
}
