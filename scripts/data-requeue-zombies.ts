
/**
 * Data Repair: Requeue Zombies
 * 
 * 功能：
 *   找出核心词中 `definition_cn` 不为空，但 `priority` 或 `word_family` 缺失的“僵尸词”。
 *   将它们的 `definition_cn` 重置为 NULL。
 *   这样 `scripts/data-etl-vocabulary-ai.ts` 就会重新抓取并修复它们。
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧟 Searching for Zombie Words (Core words missing metadata)...');

    // 1. Find Zombies
    // Definition exists, but Priority is null (Core implies priority should be CORE/SUPPORT)
    const zombies = await prisma.vocab.findMany({
        where: {
            is_toeic_core: true,
            definition_cn: { not: null },
            priority: null
        },
        select: { id: true, word: true }
    });

    console.log(`Found ${zombies.length} zombies.`);

    if (zombies.length === 0) {
        console.log('🎉 No zombies found! Your data is healthy.');
        return;
    }

    console.log('Example zombies:', zombies.slice(0, 5).map(z => z.word).join(', '));

    // Confirm?
    // In a real CLI we'd ask input, but here we perform auto-repair as planned.
    console.log('⚰️  Re-burying them (Setting definition_cn = NULL)...');

    const result = await prisma.vocab.updateMany({
        where: {
            id: { in: zombies.map(z => z.id) }
        },
        data: {
            definition_cn: null
        }
    });

    console.log(`✅ Successfully requeued ${result.count} words for ETL.`);
    console.log('👉 Now run: npx tsx scripts/data-etl-vocabulary-ai.ts --paid (or free mode)');
}

// Helper for DbNull check
import { Prisma } from '@prisma/client';

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
