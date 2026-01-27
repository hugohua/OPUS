import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'test-user-1';

    // Ensure user exists
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: 'test-user-1@example.com', password: 'mock-password' },
        update: {}
    });

    // Check if user exists or creates mock user
    // In this system, user might be just a string ID or in User table. 
    // Assuming string ID is enough for UserProgress.

    // Get some random vocabs to mark as LEARNING
    const vocabs = await prisma.$queryRaw<{ id: number, word: string }[]>`
        SELECT id, word FROM "Vocab" 
        WHERE embedding IS NOT NULL 
        LIMIT 10
    `;

    console.log(`Seeding progress for ${vocabs.length} words...`);

    for (const v of vocabs) {
        await prisma.userProgress.upsert({
            where: {
                userId_vocabId: { userId, vocabId: v.id }
            },
            update: { status: 'LEARNING', next_review_at: new Date() },
            create: {
                userId,
                vocabId: v.id,
                status: 'LEARNING',
                next_review_at: new Date(),
                state: 1, // Learning
                stability: 1.0,
                difficulty: 5.0
            }
        });
    }

    console.log('Done seeding.');
}

main().finally(() => prisma.$disconnect());
