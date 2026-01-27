/**
 * 分析缺失 Collocations 的词汇分布
 * 
 * 功能：
 *   统计 collocations 为空的词汇，按 priority, is_toeic_core, cefrLevel 分布
 * 
 * 使用方法：
 *   npx tsx scripts/inspect-missing-collocations.ts
 */

try { process.loadEnvFile(); } catch { }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('正在分析缺失 Collocations 的词汇...\n');

    // 1. 按 Priority 分布
    const byPriority = await prisma.$queryRaw<Array<{ priority: string | null; count: bigint }>>`
        SELECT priority, COUNT(*) as count
        FROM "Vocab"
        WHERE collocations IS NULL OR jsonb_array_length(collocations) = 0
        GROUP BY priority
        ORDER BY count DESC
    `;
    console.log('=== 按 Priority 分布 ===');
    byPriority.forEach(row => {
        console.log(`  ${(row.priority || 'NULL').padEnd(10)}: ${row.count}`);
    });

    // 2. 按 is_toeic_core 分布
    const byCore = await prisma.$queryRaw<Array<{ is_toeic_core: boolean | null; count: bigint }>>`
        SELECT is_toeic_core, COUNT(*) as count
        FROM "Vocab"
        WHERE collocations IS NULL OR jsonb_array_length(collocations) = 0
        GROUP BY is_toeic_core
        ORDER BY count DESC
    `;
    console.log('\n=== 按 is_toeic_core 分布 ===');
    byCore.forEach(row => {
        const label = row.is_toeic_core === true ? 'CORE' : row.is_toeic_core === false ? 'NON-CORE' : 'NULL';
        console.log(`  ${label.padEnd(10)}: ${row.count}`);
    });

    // 3. 按 CEFR 分布
    const byCefr = await prisma.$queryRaw<Array<{ cefrLevel: string | null; count: bigint }>>`
        SELECT "cefrLevel", COUNT(*) as count
        FROM "Vocab"
        WHERE collocations IS NULL OR jsonb_array_length(collocations) = 0
        GROUP BY "cefrLevel"
        ORDER BY count DESC
    `;
    console.log('\n=== 按 CEFR Level 分布 ===');
    byCefr.forEach(row => {
        console.log(`  ${(row.cefrLevel || 'NULL').padEnd(10)}: ${row.count}`);
    });

    // 4. 样本词汇
    const samples = await prisma.$queryRaw<Array<{
        word: string;
        priority: string | null;
        is_toeic_core: boolean | null;
        cefrLevel: string | null;
    }>>`
        SELECT word, priority, is_toeic_core, "cefrLevel"
        FROM "Vocab"
        WHERE collocations IS NULL OR jsonb_array_length(collocations) = 0
        ORDER BY word ASC
        LIMIT 20
    `;
    console.log('\n=== 样本词汇 (前20个) ===');
    console.table(samples);

    // 5. 总结
    const total = byPriority.reduce((sum, r) => sum + Number(r.count), 0);
    console.log(`\n📊 总计缺失 Collocations 的词汇: ${total}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
