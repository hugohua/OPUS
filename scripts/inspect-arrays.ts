
/**
 * Inspect Array Fields
 * 
 * 功能：
 *   随机抽样 20 个 CORE 单词，打印其 synonyms 和 tags 的原始内容和长度。
 *   用于验证是否存在 "看似有值实为空数组" 或 "全为空数组" 的情况。
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Inspecting Synonyms & Tags for 20 Random NON-CORE words...');

    // Get total count of NON-CORE words
    const count = await prisma.vocab.count({
        where: { is_toeic_core: false }
    });

    console.log(`Checking NON-CORE words (Total: ${count})...`);

    // Random skip
    const skip = Math.floor(Math.random() * (Math.max(0, count - 20)));

    const words = await prisma.vocab.findMany({
        where: { is_toeic_core: false },
        select: {
            id: true,
            word: true,
            synonyms: true,
            tags: true,
        },
        take: 20,
        skip: skip,
    });

    console.log(`\nSampled ${words.length} words (Offset: ${skip}/${count}):\n`);
    console.log(`| ${'Word'.padEnd(15)} | ${'Synonyms'.padEnd(30)} | ${'Tags'.padEnd(20)} |`);
    console.log(`|-${'-'.repeat(15)}-|-${'-'.repeat(30)}-|-${'-'.repeat(20)}-|`);

    let emptySynonyms = 0;
    let emptyTags = 0;

    words.forEach(w => {
        const synStr = JSON.stringify(w.synonyms);
        const tagStr = JSON.stringify(w.tags);

        console.log(`| ${w.word.padEnd(15)} | ${synStr.substring(0, 30).padEnd(30)} | ${tagStr.substring(0, 20).padEnd(20)} |`);

        if (!w.synonyms || w.synonyms.length === 0) emptySynonyms++;
        if (!w.tags || w.tags.length === 0) emptyTags++;
    });

    console.log('\n--- Summary of Sample ---');
    console.log(`Total Sampled: ${words.length}`);
    console.log(`Empty Synonyms: ${emptySynonyms}`);
    console.log(`Empty Tags:     ${emptyTags}`);

    // Check *global* empty tags/synonyms
    const totalEmptyTags = await prisma.vocab.count({
        where: {
            tags: { isEmpty: true }
        }
    });

    // Check synonyms empty
    // Prisma doesn't always support isEmpty for scalar lists exactly the same in all versions, 
    // but usually it works. If not, use equals: []
    const totalEmptySynonyms = await prisma.vocab.count({
        where: {
            synonyms: { equals: [] }
        }
    });

    console.log(`\n--- Global Check (Entire DB) ---`);
    console.log(`Total words with Empty Tags:     ${totalEmptyTags}`);
    console.log(`Total words with Empty Synonyms: ${totalEmptySynonyms}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
