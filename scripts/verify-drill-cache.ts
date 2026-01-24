/**
 * 验证 Drill Cache 逻辑
 * 功能：
 *   1. 创建一个模拟的 DrillCache 条目
 *   2. 尝试读取它 (findCachedDrill)
 *   3. 模拟消费 (markDrillConsumed)
 *   4. 再次读取 (应为空)
 * 使用方法：
 *   npx tsx scripts/verify-drill-cache.ts
 */
// import { tryLoadEnv } from './utils/env';
// tryLoadEnv();

// Load environment variables
if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(); } catch (e) { /* ignore if no file */ }
}

import { db } from '@/lib/db';
import { findCachedDrill, markDrillConsumed, saveDrillToCache } from '@/lib/drill-cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('verify-cache');

async function main() {
    const userId = "cm62v78u00000356k12345678"; // Mock ID, ensure db seeds run or this might fail foreign key if user doesn't exist. 
    // Actually we need a real user. Let's pick the first user.
    const user = await db.user.findFirst();
    if (!user) {
        console.error("❌ No users found in DB. Please seed first.");
        return;
    }

    const MODE = "SYNTAX";

    console.log(`👤 User: ${user.email} (${user.id})`);

    // 1. Clean old cache
    await db.drillCache.deleteMany({ where: { userId: user.id } });
    console.log("🧹 Cleaned old cache");

    // 2. Create Cache
    const mockPayload = [{ meta: { mode: MODE }, segments: [] }];
    const cacheEntry = await saveDrillToCache(user.id, MODE, mockPayload as any);
    console.log(`✅ Created cache entry: ${cacheEntry.id}`);

    // 3. Find Cache
    const found = await findCachedDrill(user.id, MODE);
    if (found && found.id === cacheEntry.id) {
        console.log("✅ findCachedDrill: HIT");
    } else {
        console.error("❌ findCachedDrill: MISS");
        process.exit(1);
    }

    // 4. Consume
    await markDrillConsumed(found.id);
    console.log("✅ Marked as consumed");

    // 5. Find Again (Should be null)
    const foundAgain = await findCachedDrill(user.id, MODE);
    if (!foundAgain) {
        console.log("✅ findCachedDrill (Consumed): HIT (Returned null as expected)");
    } else {
        console.error("❌ findCachedDrill (Consumed): FAILED (Should be null)");
        process.exit(1);
    }

    console.log("🎉 Drill Cache Logic Verified!");
}

main().catch(console.error);
