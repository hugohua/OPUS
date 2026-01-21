'use server';

import { prisma } from '@/lib/prisma';
import { generateBriefingAction } from '@/actions/generate-briefing';
import type { ActionState } from '@/types';
import type { BriefingPayload } from '@/lib/validations/briefing';
import { unstable_noStore as noStore } from 'next/cache';

/**
 * Main Game Loop Action
 * Fetches the next appropriate word and generates a Level 0 Briefing.
 */
export async function getNextBriefing(todayCount: number): Promise<ActionState<BriefingPayload>> {
    noStore(); // Disable caching for fresh questions

    try {
        // 1. Pick a random CORE word
        // In production, this would be a complex Spaced Repetition query.
        // For Level 0 MVP, we just pick a random eligible word from the DB.

        // Optimize: Get a random ID or use skip. 
        // With limited rows, skip is fine.
        const whereClause = { is_toeic_core: true };
        const count = await prisma.vocab.count({ where: whereClause });

        if (count === 0) {
            return {
                status: 'error',
                message: 'Database is empty or no CORE words found. Please seed the database.',
            };
        }

        const skip = Math.floor(Math.random() * count);
        const word = await prisma.vocab.findFirst({
            where: whereClause,
            take: 1,
            skip: skip,
        });

        if (!word) {
            return {
                status: 'error',
                message: 'Failed to fetch a target word.',
            };
        }

        // 2. Prepare Context (1+N Rule)
        // Fetch 3 random "Context Candidates" (The "N")
        // Rule: Must be Adjectives or Nouns to fit into <s>Subject</s> or <o>Object</o> slots.
        // We look for 'n' or 'adj' in word_family, or fallback to ANY if data sparse.
        const contextCandidates = await prisma.$queryRaw<Array<{ word: string }>>`
            SELECT word FROM "Vocab"
            WHERE word != ${word.word}
            AND CHAR_LENGTH(word) > 3
            AND (
                word_family->>'n' IS NOT NULL 
                OR word_family->>'adj' IS NOT NULL
                OR definitions->>'business_cn' IS NOT NULL -- Fallback: Business words usually encompass N/Adj
            )
            ORDER BY RANDOM()
            LIMIT 3;
        `;

        const contextWords = contextCandidates.map(c => c.word);

        // 'word_family' is stored as JSON in Prisma
        const family = (word.word_family as Record<string, string>) || { v: word.word }; // Fallback to identity

        // 3. Call Generator
        // This ensures the strict "Smart Backend" logic is encapsulated
        return await generateBriefingAction({
            targetWord: word.word,
            meaning: word.definition_cn || '暂无释义',
            contextWords: contextWords,
            wordFamily: family,
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
