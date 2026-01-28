/**
 * ❌ DISTRACTOR SELECTOR (Pending Implementation)
 * * CRITICAL ARCHITECTURE NOTE:
 * Do NOT use the ContextSelector algorithm here.
 * ContextSelector looks for SEMANTICALLY RELATED words (for sentences).
 * DistractorSelector must look for:
 * 1. Lookalikes (Levenshtein distance)
 * 2. Same POS (Part of Speech)
 * 3. Topic Clashes (to avoid ambiguous answers)
 */

import { Vocab } from '@prisma/client';

export class DistractorSelector {
    /**
     * Select distractors for a multiple choice question.
     * @throws Error - Not implemented yet.
     */
    static async select(
        target: Vocab,
        count: number = 3
    ): Promise<Vocab[]> {
        throw new Error(
            'DistractorSelector is NOT implemented yet. ' +
            'Do NOT use ContextSelector as a fallback, as it generates semantically related synonyms which are bad distractors.'
        );
    }
}
