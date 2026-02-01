'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

/**
 * Suspend a vocab (mark as Mastered/Ignored)
 * Temporarily maps to MASTERED status until we have a proper SUSPENDED state.
 */
export async function suspendVocab(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    // Reset all tracks to NEW
    await prisma.userProgress.updateMany({
        where: {
            userId,
            vocabId,
        },
        data: {
            status: 'MASTERED', // Semantically "Finalized" for now
            next_review_at: null, // Remove from schedule
        }
    });

    revalidatePath('/dashboard');
}

/**
 * Reset FSRS progress for a vocab (Factory Reset)
 */
export async function resetVocabProgress(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    await prisma.userProgress.updateMany({
        where: {
            userId,
            vocabId,
        },
        data: {
            status: 'NEW',
            stability: 0,
            difficulty: 0,
            reps: 0,
            lapses: 0,
            state: 0, // State.New
            last_review_at: null,
            next_review_at: new Date(), // Due immediately
            interval: 0
        }
    });

    console.log(`[VOCAB_ACTION] User ${userId} reset progress for Vocab ${vocabId}`);
    revalidatePath('/dashboard');
}

/**
 * Get raw data for "Inspect JSON"
 */
export async function getVocabRawData(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const vocab = await prisma.vocab.findUnique({
        where: { id: vocabId },
        include: {
            smartContent: {
                select: {
                    type: true,
                    scenario: true,
                    model: true,
                    createdAt: true
                }
            }
        }
    });

    const progress = await prisma.userProgress.findMany({
        where: {
            userId: session.user.id,
            vocabId
        }
    });

    return { vocab, progress };
}
