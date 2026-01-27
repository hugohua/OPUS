/**
 * Check Database Count
 * 
 * 功能：
 *   统计数据库中各表的数据量 (User, Vocab, UserProgress, Article)。
 *   用于确认 ETL 或数据迁移的结果。
 * 
 * 使用方法：
 *   npx tsx scripts/db-count.ts
 */

import { PrismaClient } from '@prisma/client';

// Load env
try {
    process.loadEnvFile();
} catch (e) {
    // ignore
}

const prisma = new PrismaClient();

async function main() {
    console.log('正在统计当前数据库数据量...');

    try {
        const userCount = await prisma.user.count();
        const vocabCount = await prisma.vocab.count();
        const progressCount = await prisma.userProgress.count();
        const articleCount = await prisma.article.count();

        console.log('--------------------------------');
        console.log(`[User] 用户表: ${userCount} 条`);
        console.log(`[Vocab] 词汇表: ${vocabCount} 条`);
        console.log(`[UserProgress] 学习进度表: ${progressCount} 条`);
        console.log(`[Article] 文章表: ${articleCount} 条`);
        console.log('--------------------------------');

        if (vocabCount > 0) {
            console.log('⚠️ 注意：重置数据库将需要重新运行 ETL 脚本 (enrich-vocab.ts) 来恢复词汇数据。');
        }

        if (progressCount > 0) {
            console.log('⚠️ 警告：重置将永久丢失用户的学习进度！');
        }

    } catch (error) {
        console.error('无法连接数据库或表不存在:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
