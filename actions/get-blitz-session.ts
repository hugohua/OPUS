/**
* Get Blitz Session Action
* 功能：
*   获取极速跟读模式 (Phrase Blitz) 的复习队列
* 逻辑：
*   采用 "Smart Stream" 混合流 + "30/50/20" 协议 (Rescue/Review/New)
*   1. Rescue Bucket (30% = 6): 救援队列 (Weak Syntax, V < 30)
*   2. Review Bucket (50% = 10): 复习队列 (Memory Decay, Due Now)
*   3. New Bucket (20% = 4): 新词队列 (Acquisition, Status=NEW)
*   4. Waterfall Fill: 瀑布流填充与去重，不足时自动回填
*/
'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BlitzSessionData } from '@/lib/validations/blitz';
import { redirect } from 'next/navigation';

const log = createLogger('actions:get-blitz-session');

// [Protocol Constants]
// Total Batch Size = 20
const RESCUE_COUNT = 6;  // 30%
const REVIEW_COUNT = 10; // 50%
const NEW_COUNT = 4;     // 20%
const TOTAL_COUNT = 20;

export async function getBlitzSession(): Promise<ActionState<BlitzSessionData>> {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    try {
        const userId = session.user.id;
        const now = new Date();

        log.info({ userId }, 'Starting Daily Blitz Session Generation (30/50/20 Protocol)');

        // ==========================================
        // 1. Parallel Bucket Fetch
        // ==========================================

        const [rescueCandidates, reviewCandidates, newCandidates] = await Promise.all([
            // Bucket A: Rescue (Weak Syntax)
            prisma.userProgress.findMany({
                where: {
                    userId,
                    track: { in: ['VISUAL', 'AUDIO', 'CONTEXT'] },
                    status: { in: ['LEARNING', 'REVIEW'] },
                    dim_v_score: { lt: 30 } // Logic: Rescue low syntax score
                },
                include: { vocab: { select: vocabSelector } },
                orderBy: { vocab: { frequency_score: 'desc' } }, // High Value First
                take: RESCUE_COUNT // Strict Cap
            }),

            // Bucket B: Review (Memory Decay)
            prisma.userProgress.findMany({
                where: {
                    userId,
                    track: { in: ['VISUAL', 'AUDIO', 'CONTEXT'] },
                    status: { in: ['LEARNING', 'REVIEW'] },
                    next_review_at: { lte: now }
                },
                include: { vocab: { select: vocabSelector } },
                orderBy: { next_review_at: 'asc' }, // Most Urgent First
                take: 20 // Fetch extra to handle overlaps
            }),

            // Bucket C: New (Acquisition)
            prisma.userProgress.findMany({
                where: {
                    userId,
                    status: 'NEW'
                },
                include: { vocab: { select: vocabSelector } },
                orderBy: { vocab: { frequency_score: 'desc' } }, // High Value First
                take: 10 // Fetch extra buffer
            })
        ]);

        log.info({
            rescueFound: rescueCandidates.length,
            reviewFound: reviewCandidates.length,
            newFound: newCandidates.length
        }, 'Buckets fetched');

        // ==========================================
        // 2. Waterfall Fill & Deduplication
        // ==========================================

        const finalSession: any[] = [];
        const seenVocabIds = new Set<number>();

        // Helper to add unique items (deduplicate by vocabId to prevent same word appearing twice)
        const addItems = (items: any[], limit: number) => {
            let addedCount = 0;
            for (const item of items) {
                if (addedCount >= limit) break;
                // [Fix] Deduplicate by vocabId, not UserProgress.id
                if (!seenVocabIds.has(item.vocabId)) {
                    finalSession.push(item);
                    seenVocabIds.add(item.vocabId);
                    addedCount++;
                }
            }
            return addedCount;
        };

        // Step 1: Fill Rescue (Target: 6)
        const rescueCount = addItems(rescueCandidates, RESCUE_COUNT);

        // Step 2: Fill Review (Target: 10)
        // Note: Review items might duplicate Rescue items, 'seenIds' prevents this.
        const reviewCount = addItems(reviewCandidates, REVIEW_COUNT);

        // Step 3: Fill New (Target: 4)
        const newCount = addItems(newCandidates, NEW_COUNT);

        log.info({ rescueCount, reviewCount, newCount }, 'Initial Fill Complete');

        // Step 4: Backfill (Ensure 20 items)
        let needed = TOTAL_COUNT - finalSession.length;
        if (needed > 0) {
            log.info({ needed }, 'Performing Backfill');

            // Priority 1: More Review
            if (needed > 0) {
                const extraReview = addItems(reviewCandidates, needed); // Add remaining unique review items
                needed -= extraReview;
            }

            // Priority 2: More New
            if (needed > 0) {
                const extraNew = addItems(newCandidates, needed); // Add remaining unique new items
                needed -= extraNew;
            }

            // Priority 3: (Future) Emergency Fetch from Global Vocab if still needed
            // For MVP, we accept < 20 if user has no data
        }

        if (finalSession.length === 0) {
            return {
                status: 'success',
                message: 'No items available for session',
                data: { sessionId: crypto.randomUUID(), items: [] }
            };
        }

        // ==========================================
        // 3. Transform & Mask (Payload Generation)
        // ==========================================

        const items = finalSession.map(p => {
            const word = p.vocab.word;
            let collocations: any[] = [];

            if (Array.isArray(p.vocab.collocations)) {
                collocations = p.vocab.collocations;
            }

            // Fallback Logic
            let chosenPhrase = {
                text: word,
                trans: p.vocab.definition_cn || '暂无释义'
            };

            if (collocations.length > 0) {
                const randomIndex = Math.floor(Math.random() * collocations.length);
                const selected = collocations[randomIndex];
                if (selected && typeof selected === 'object') {
                    chosenPhrase = {
                        text: selected.text || word,
                        trans: selected.trans || '暂无释义'
                    };
                }
            }

            // Generate Mask (Case Insensitive)
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const maskRegex = new RegExp(escapedWord, 'gi');
            const maskedText = chosenPhrase.text.replace(maskRegex, '_______');

            return {
                id: p.id,
                vocabId: p.vocab.id,
                word: word,
                frequency_score: p.vocab.frequency_score,
                track: p.track, // [NEW] Pass source track for FSRS persistence
                context: {
                    text: chosenPhrase.text,
                    maskedText: maskedText,
                    translation: chosenPhrase.trans,
                }
            };
        });

        // Final Shuffle (so user doesn't feel the buckets)
        const shuffledItems = items.sort(() => Math.random() - 0.5);

        log.info({ totalItems: shuffledItems.length }, 'Session Generated Successfully');

        return {
            status: 'success',
            message: 'Session generated',
            data: {
                sessionId: crypto.randomUUID(),
                items: shuffledItems
            }
        };

    } catch (error: any) {
        log.error({ error }, 'Failed to get blitz session');
        return {
            status: 'error',
            message: 'Failed to generate session'
        };
    }
}

// Projection Helper
const vocabSelector = {
    id: true,
    word: true,
    frequency_score: true,
    collocations: true,
    definition_cn: true,
};
