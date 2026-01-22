'use server';

import { generateBriefingAction } from '@/actions/generate-briefing';
import { getNextDrillWord } from '@/actions/get-next-drill';
import { getMockUser } from '@/lib/auth-mock';
import type { BriefingPayload } from '@/lib/validations/briefing';
import type { ActionState } from '@/types';
import { unstable_noStore as noStore } from 'next/cache';

/**
 * Main Game Loop Action
 * Fetches the next appropriate word using the 3-Level Funnel and generates a Level 0 Briefing.
 */
export async function getNextBriefing(todayCount: number): Promise<ActionState<BriefingPayload>> {
    noStore(); // Disable caching for fresh questions

    try {
        // 1. Get User (Mock for Level 0 MVP)
        const user = await getMockUser();

        // 2. Execute 3-Level Funnel Selection
        const drillData = await getNextDrillWord(user.id);

        if (!drillData) {
            return {
                status: 'error',
                message: 'No suitable drill words found. Please ensure database is seeded with Level 0 vocabs.',
            };
        }

        // 3. Call Generator
        // This ensures the strict "Smart Backend" logic is encapsulated
        return await generateBriefingAction({
            targetWord: drillData.targetWord,
            vocabId: drillData.vocabId, // [New]
            meaning: drillData.meaning,
            contextWords: drillData.contextWords,
            wordFamily: drillData.wordFamily,
            todayCount: todayCount
        });

    } catch (error) {
        console.error('Game Loop Error:', error);
        return {
            status: 'error',
            message: 'Internal Server Error in Game Loop',
        };
    }
}
