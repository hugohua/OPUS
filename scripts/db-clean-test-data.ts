
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting cleanup of test data (test_word%)...');

    try {
        // Count first
        const count = await prisma.vocab.count({
            where: {
                word: {
                    startsWith: 'test_word'
                }
            }
        });

        console.log(`Found ${count} test words to cleanup.`);

        if (count > 0) {
            // 1. Find IDs of test vocabs
            const vocabs = await prisma.vocab.findMany({
                where: { word: { startsWith: 'test_word' } },
                select: { id: true }
            });
            const vocabIds = vocabs.map(v => v.id);

            // 2. Delete dependent UserProgress
            const { count: deletedProgress } = await prisma.userProgress.deleteMany({
                where: { vocabId: { in: vocabIds } }
            });
            console.log(`Deleted ${deletedProgress} related UserProgress records.`);

            // 3. Delete dependent ArticleVocab (if any)
            const { count: deletedArticleVocab } = await prisma.articleVocab.deleteMany({
                where: { vocabId: { in: vocabIds } }
            });
            console.log(`Deleted ${deletedArticleVocab} related ArticleVocab records.`);

            // 4. Delete Vocab
            const { count: deletedVocab } = await prisma.vocab.deleteMany({
                where: { id: { in: vocabIds } }
            });
            console.log(`✅ Successfully deleted ${deletedVocab} Vocab records.`);
        } else {
            console.log('No test data found. Database is clean.');
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
