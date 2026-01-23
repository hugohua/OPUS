/**
 * Vocabulary Statistics
 * 
 * 功能：
 *   统计词汇库的分布情况 (Level, Priority, Tags)。
 * 
 * 使用方法：
 *   npx tsx scripts/db-vocab-stats.ts
 */
try { process.loadEnvFile(); } catch (e) { }

import { Prisma, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    const total = await prisma.vocab.count();

    // 完全未处理的记录 (没有 AI 增强)
    const unprocessed = await prisma.vocab.count({
        where: { definition_cn: null }
    });

    // 已处理但缺少新字段 (有 definition_cn 但 word_family 为 DbNull)
    const needsUpdate = await prisma.vocab.count({
        where: {
            definition_cn: { not: null },
            word_family: { equals: Prisma.DbNull }
        }
    });

    // 已完整处理 (有 word_family)
    const complete = await prisma.vocab.count({
        where: {
            definition_cn: { not: null },
            NOT: { word_family: { equals: Prisma.DbNull } }
        }
    });

    // 统计 partOfSpeech 分布
    const posStats = await prisma.vocab.groupBy({
        by: ['partOfSpeech'],
        _count: {
            _all: true
        }
    });

    console.log('=== 数据库词汇统计 ===');
    console.log(`总词汇数: ${total}`);
    console.log(`未处理 (definition_cn = null): ${unprocessed}`);
    console.log(`需补全新字段 (有 definition_cn 但缺 word_family): ${needsUpdate}`);
    console.log(`已完整处理: ${complete}`);

    console.log('\n=== Part of Speech 分布 (按数量降序) ===');
    posStats
        .sort((a, b) => b._count._all - a._count._all)
        .forEach(stat => {
            const pos = stat.partOfSpeech === null ? 'NULL' : stat.partOfSpeech;
            console.log(`${pos.padEnd(20)}: ${stat._count._all}`);
        });
}

main().finally(() => prisma.$disconnect());
