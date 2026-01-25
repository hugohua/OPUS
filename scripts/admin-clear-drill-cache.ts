
import 'dotenv/config';
import { redis } from '@/lib/queue/connection';
import { db } from '@/lib/db';

const USER_ID = "cmkqwimx60000gvsxdc2jj027"; // Hardcoded from logs for diagnosis

async function main() {
    console.log(`--- Purging Drill Cache for User: ${USER_ID} ---`);

    // 1. Clear Redis Inventory
    console.log('\n[Redis] Scanning keys...');
    const pattern = `user:${USER_ID}:mode:*:vocab:*:drills`;
    let cursor = '0';
    let keysToDelete: string[] = [];

    do {
        const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = res[0];
        keysToDelete.push(...res[1]);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        console.log(`✅ Deleted ${keysToDelete.length} Drill Inventory Lists from Redis.`);
    } else {
        console.log('ℹ️ No Redis keys found.');
    }

    // 2. Clear Session State (Current Progress)
    const sessionKeys = await redis.keys(`user:${USER_ID}:session:*`);
    if (sessionKeys.length > 0) {
        await redis.del(...sessionKeys);
        console.log(`✅ Deleted ${sessionKeys.length} active sessions.`);
    }

    // 3. Clear Stats (Force re-sync)
    const statsKeys = await redis.keys(`user:${USER_ID}:inventory:stats`);
    if (statsKeys.length > 0) {
        await redis.del(...statsKeys);
        console.log(`✅ Deleted Inventory Stats.`);
    }

    console.log('\n✅ PURGE COMPLETE. Please restart the session to fetch fresh drills.');
    process.exit(0);
}

main().catch(console.error);
