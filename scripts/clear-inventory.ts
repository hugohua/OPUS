
/**
 * 🛠️ 脚本：库存缓存清理工具
 * 
 * 描述：
 * 用于强制清理指定用户的 Redis 库存缓存（Drills）和统计信息（Stats）。
 * 当开发过程中遇到缓存数据不一致或需要重置测试环境时使用。
 * 
 * 用法：
 * npx tsx scripts/clear-inventory.ts [UserEmail] [--db]
 * 
 * 参数：
 * - [UserEmail]: 目标用户的邮箱
 * - --db: 同时清空数据库中的 DrillCache 表（持久化存储）
 * 
 * 依赖：
 * - Redis (Inventory Queue & Stats)
 * - DB (User Query)
 */
import 'dotenv/config';
import { redis } from '@/lib/queue/connection';
import { db } from '@/lib/db';

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('Usage: tsx scripts/clear-inventory.ts <email>');
        process.exit(1);
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
        console.error(`User not found: ${email}`);
        process.exit(1);
    }

    const userId = user.id;
    console.log(`Clearing inventory for user: ${email} (${userId})`);

    // 1. Delete Stats Key
    const statsKey = `user:${userId}:inventory:stats`;
    const statsExists = await redis.exists(statsKey);
    if (statsExists) {
        await redis.del(statsKey);
        console.log(`✅ Deleted stats key: ${statsKey}`);
    } else {
        console.log(`ℹ️ Stats key not found: ${statsKey}`);
    }

    // 2. Scan and Delete Drill Keys
    const pattern = `user:${userId}:mode:*:vocab:*:drills`;
    let cursor = '0';
    let drillKeys: string[] = [];
    do {
        const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = res[0];
        drillKeys.push(...res[1]);
    } while (cursor !== '0');

    if (drillKeys.length > 0) {
        // Delete in batches of 1000
        const batchSize = 1000;
        for (let i = 0; i < drillKeys.length; i += batchSize) {
            const batch = drillKeys.slice(i, i + batchSize);
            await redis.del(...batch);
            console.log(`✅ Deleted batch ${i / batchSize + 1}/${Math.ceil(drillKeys.length / batchSize)} (${batch.length} keys)`);
        }
        console.log(`🎉 Cleared total ${drillKeys.length} drill keys.`);
    } else {
        console.log('ℹ️ No drill keys found.');
    }

    // 3. Clear from Replenish Buffer (Optional but good for consistency)
    // The buffer is a Set of "userId:mode:vocabId" strings.
    // We need to scan the set members and remove those starting with userId.
    // However, SSW (Set Scan) is not always efficient if the set is huge. 
    // Given the buffer is for "replenish", clearing it ensures no pending replenish jobs are stuck.

    // Actually, let's just leave the buffer alone for now unless requested. 
    // The buffer just triggers a re-fetch. If we clear the inventory, a re-fetch is good.
    // BUT if the buffer has items, they will be processed and pushed to the inventory we just cleared.
    // This assumes the user wants a clean slate. 
    // Let's print a warning about the buffer.

    const bufferKey = 'buffer:replenish_drills';
    const bufferSize = await redis.scard(bufferKey);
    console.log(`ℹ️ Replenish buffer (global) has ${bufferSize} items. (Not cleared)`);

    // 4. Clear Database DrillCache (Optional)
    const clearDb = process.argv.includes('--db') || process.argv.includes('--all');

    if (clearDb) {
        console.log('🗑️ Clearing Database DrillCache...');
        try {
            // Prisma model for DrillCache
            const { count } = await db.drillCache.deleteMany({
                where: { userId }
            });
            console.log(`✅ Deleted ${count} records from DrillCache (Postgres).`);
        } catch (error) {
            console.error('❌ Failed to delete DrillCache:', error);
        }
    } else {
        console.log('ℹ️ Database DrillCache skipped. Use --db to clear it too.');
    }

    console.log('Done.');
    process.exit(0);
}

main();
