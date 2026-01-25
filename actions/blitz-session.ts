'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

import { BlitzItem } from '@/lib/validations/blitz';

export type BlitzSessionState = {
    status: 'success' | 'error';
    message: string;
    data?: BlitzItem[];
};

/**
 * 获取 Phrase Blitz 练习批次
 */
export async function getBlitzBatch(): Promise<BlitzSessionState> {
    const session = await auth();
    if (!session?.user?.id) {
        return { status: 'error', message: 'Unauthorized' };
    }

    const userId = session.user.id;

    try {
        const candidates = await prisma.userProgress.findMany({
            where: {
                userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                vocab: {
                    collocations: { not: Prisma.DbNull },
                },
            },
            include: {
                vocab: true,
            },
            orderBy: [
                { lapses: 'desc' },
                { vocab: { frequency_score: 'desc' } }, // Corrected priority logic
            ],
            take: 50,
        });

        const batch: BlitzItem[] = [];

        for (const p of candidates) {
            if (batch.length >= 10) break;

            const v = p.vocab;
            if (!v.collocations || !Array.isArray(v.collocations) || v.collocations.length === 0) {
                continue;
            }

            const collys = v.collocations as any[];
            const firstColly = collys[0];

            if (!firstColly || !firstColly.text) continue;

            batch.push({
                id: p.id, // UserProgress ID (CUID)
                vocabId: v.id,
                word: v.word,
                frequency_score: v.frequency_score,
                context: {
                    text: firstColly.text,
                    maskedText: firstColly.text.replace(v.word, '____'), // Simple mask
                    translation: firstColly.trans || v.definition_cn || 'No translation',
                }
            });
        }

        // Shuffle
        const shuffled = batch.sort(() => Math.random() - 0.5);

        return {
            status: 'success',
            message: 'Batch fetched',
            data: shuffled,
        };
    } catch (error) {
        console.error('getBlitzBatch Error:', error);
        return { status: 'error', message: 'Failed to fetch blitz batch' };
    }
}
