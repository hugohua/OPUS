/**
 * 验证数据持久化脚本
 * 功能：
 *   查询最近更新的 UserProgress 记录
 *   用于验证 recordOutcome 是否成功写入数据库
 * 使用方法：
 *   npx tsx scripts/verify-persistence.ts
 * 注意：
 *   1. 需要 .env 包含 DATABASE_URL
 */
try { process.loadEnvFile(); } catch (e) { console.warn('Env not loaded via process.loadEnvFile'); }

import { prisma } from '@/lib/prisma';

async function main() {
    console.log('--- Checking UserProgress Persistence ---');

    const recentRecords = await prisma.userProgress.findMany({
        where: {
            last_review_at: {
                not: null
            }
        },
        orderBy: {
            last_review_at: 'desc'
        },
        take: 5,
        include: {
            vocab: true,
            user: true
        }
    });

    console.log(`Found ${recentRecords.length} records with last_review_at set.`);

    if (recentRecords.length === 0) {
        console.log('No records found. Try interacting with the app first.');
    } else {
        console.table(recentRecords.map(p => ({
            User: p.user?.email || p.userId,
            Word: p.vocab.word,
            Status: p.status,
            LastReview: p.last_review_at?.toLocaleString(),
            NextReview: p.next_review_at?.toLocaleString(),
            Interval: p.interval,
            DimV: p.dim_v_score
        })));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
