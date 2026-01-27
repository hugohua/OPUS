import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'test-user-1';

    // 1. Get a target word that definitely has progress? 
    // Wait, target word is selected by `selectTargetWord` which checks `status NOT 'NEW'`, so target word is NEW.
    // In seed script, we marked 10 words as LEARNING.
    // `selectTargetWord` (via Service) selects a NEW word.
    // Does that NEW word have embedding?
    // Let's manually pick a word id that has embedding but is NOT in UserProgress (or ignore user progress for target)

    const targetWords = await prisma.$queryRaw<{ id: number, word: string }[]>`
        SELECT id, word FROM "Vocab" 
        WHERE embedding IS NOT NULL 
        LIMIT 1
    `;
    const targetWord = targetWords[0];

    if (!targetWord) {
        console.log('No word with embedding found.');
        return;
    }

    console.log(`Target: ${targetWord.word} (${targetWord.id})`);

    // 2. Run the RAW query exactly as in Service
    // Note: status in set ('LEARNING', 'REVIEW')
    const count = 5;

    // We expect the 10 seeded words to be returned (if they are not the target)
    try {
        const vectorResults = await prisma.$queryRaw<any[]>`
            SELECT v.id, v.word, (v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetWord.id})) as dist
            FROM "UserProgress" up
            JOIN "Vocab" v ON up."vocabId" = v.id
            WHERE up."userId" = ${userId}
              AND up.status IN ('LEARNING', 'REVIEW')
              AND v.id != ${targetWord.id}
              AND v.embedding IS NOT NULL
            ORDER BY dist ASC
            LIMIT ${count};
        `;

        if (!vectorResults || vectorResults.length === 0) {
            console.log('Query returned 0 results.');

            // Check if UserProgress exists
            const upCount = await prisma.userProgress.count({ where: { userId, status: { in: ['LEARNING', 'REVIEW'] } } });
            console.log(`UserProgress count for LEARNING/REVIEW: ${upCount}`);

        } else {
            console.log('Query Success!');
            console.log(vectorResults);
        }
    } catch (e) {
        console.error('Query Failed:', e);
    }
}

main().finally(() => prisma.$disconnect());
