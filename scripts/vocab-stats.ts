/**
 * 数据库词汇统计脚本
 * 
 * 功能：统计词汇表中各类处理状态的记录数量
 * 
 * 使用方法：
 *   npx tsx scripts/vocab-stats.ts
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

    console.log('=== 数据库词汇统计 ===');
    console.log(`总词汇数: ${total}`);
    console.log(`未处理 (definition_cn = null): ${unprocessed}`);
    console.log(`需补全新字段 (有 definition_cn 但缺 word_family): ${needsUpdate}`);
    console.log(`已完整处理: ${complete}`);
}

main().finally(() => prisma.$disconnect());
