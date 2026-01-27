
// Load env first
try { process.loadEnvFile(); } catch { }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Inspecting User Progress...');
    const userId = "cmkqc2y5f0001umakqjgq1856";

    // 1. Check recent progress updates
    const recentProgress = await prisma.userProgress.findMany({
        where: {
            userId: userId,
        },
        orderBy: {
            last_review_at: 'desc'
        },
        take: 5,
        include: {
            vocab: true
        }
    });

    console.log(`\nFound ${recentProgress.length} recent progress records:`);
    recentProgress.forEach(p => {
        console.log(`- [${p.vocab.word}] Status: ${p.status}, V:${p.dim_v_score}, C:${p.dim_c_score}, M:${p.dim_m_score}, Mastery: ${p.masteryMatrix}`);
        console.log(`  Last Review: ${p.last_review_at?.toISOString()}`);
    });

    // 2. Check explicitly for C-dimension (Phrase Mode) score
    // dim_c_score should be > 0 if they did Phrase Mode successfully
    const cScoreCount = recentProgress.filter(p => p.dim_c_score > 0).length;
    console.log(`\nRecords with C-Score > 0 (Phrase Mode): ${cScoreCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
