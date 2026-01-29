import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'cm66x5x5x000008l4am90956r'; // Matching sim-flow-v2.ts

    // Ensure user exists
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: 'test-sim-user@example.com', password: 'mock-password' },
        update: {}
    });

    // Check if user exists or creates mock user
    // In this system, user might be just a string ID or in User table. 
    // Assuming string ID is enough for UserProgress.

    // Get some random vocabs to mark as LEARNING
    const vocabs = await prisma.$queryRaw<{ id: number, word: string }[]>`
        SELECT id, word FROM "Vocab" 
        LIMIT 10
    `;

    console.log(`Seeding progress for ${vocabs.length} words...`);

    for (const v of vocabs) {
        // Seed VISUAL
        await prisma.userProgress.upsert({
            where: { userId_vocabId_track: { userId, vocabId: v.id, track: 'VISUAL' } },
            update: { status: 'LEARNING', next_review_at: new Date() },
            create: {
                userId, vocabId: v.id, track: 'VISUAL', status: 'LEARNING',
                next_review_at: new Date(), state: 1, stability: 1.0, difficulty: 5.0
            }
        });

        // Seed AUDIO (L1)
        await prisma.userProgress.upsert({
            where: { userId_vocabId_track: { userId, vocabId: v.id, track: 'AUDIO' } },
            update: { status: 'REVIEW', next_review_at: new Date() },
            create: {
                userId, vocabId: v.id, track: 'AUDIO', status: 'REVIEW',
                next_review_at: new Date(), state: 2, stability: 3.0, difficulty: 6.0
            }
        });

        // Seed CONTEXT (L2)
        await prisma.userProgress.upsert({
            where: { userId_vocabId_track: { userId, vocabId: v.id, track: 'CONTEXT' } },
            update: { status: 'LEARNING', next_review_at: new Date() },
            create: {
                userId, vocabId: v.id, track: 'CONTEXT', status: 'LEARNING',
                next_review_at: new Date(), state: 1, stability: 1.5, difficulty: 7.0
            }
        });
    }

    console.log('Done seeding.');
}

main().finally(() => prisma.$disconnect());
