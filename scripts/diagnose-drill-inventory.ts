
import 'dotenv/config';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { Queue } from 'bullmq';

const inventoryQueue = new Queue('drill-inventory', { connection: redis });

async function main() {
    console.log('--- Drill Inventory Diagnosis (Redis + DB) ---');

    // 1. Postgres DrillCache Stats (Use imported db)
    try {
        const totalDrills = await db.drillCache.count();
        console.log(`\n[Postgres DrillCache Table]`);
        console.log(`Total Records: ${totalDrills} (If > 0, table is still in use)`);
    } catch (e) {
        console.log(`\n[Postgres DrillCache Table] Error accessing table: ${(e as Error).message}`);
    }

    // 2. Queue Stats
    const queueCounts = await inventoryQueue.getJobCounts();
    console.log(`\n[Queue: drill-inventory]`);
    console.log(`Waiting: ${queueCounts.waiting}`);
    console.log(`Active: ${queueCounts.active}`);
    console.log(`Completed: ${queueCounts.completed}`);
    console.log(`Failed: ${queueCounts.failed}`);

    // 3. Redis Inventory Stats
    console.log(`\n[Redis Inventory Scanning]`);
    const statsKeys = await redis.keys('user:*:inventory:stats');
    console.log(`Found ${statsKeys.length} user stat keys.`);

    for (const statKey of statsKeys) {
        const userId = statKey.split(':')[1];
        const stats = await redis.hgetall(statKey);
        console.log(`\nUser: ${userId}`);
        console.log(`  KV Stats:`, stats);

        const matchPattern = `user:${userId}:mode:*:vocab:*:drills`;
        let cursor = '0';
        let drillKeys: string[] = [];
        do {
            const res = await redis.scan(cursor, 'MATCH', matchPattern, 'COUNT', 1000);
            cursor = res[0];
            drillKeys.push(...res[1]);
        } while (cursor !== '0');

        let actualCountTotal = 0;
        const actualCountByMode: Record<string, number> = {};

        for (const key of drillKeys) {
            const parts = key.split(':');
            // format: user:uid:mode:MODE:vocab:VID:drills
            // Index: 0:1, 2:3, 4:5, 6
            const mode = parts[3];
            const len = await redis.llen(key);
            actualCountTotal += len;
            actualCountByMode[mode] = (actualCountByMode[mode] || 0) + len;
        }

        console.log(`  Actual List Counts (Scanned):`);
        console.log(`    Total: ${actualCountTotal}`);
        Object.entries(actualCountByMode).forEach(([m, c]) => {
            console.log(`    ${m}: ${c}`);
        });

        const statedTotal = Object.values(stats).reduce((a, b) => a + (parseInt(b) || 0), 0);
        const diff = statedTotal - actualCountTotal;

        if (diff !== 0) {
            console.log(`  ⚠️ MISMATCH DETECTED: Stats say ${statedTotal}, Actual is ${actualCountTotal}. Diff: ${diff}`);
        } else {
            console.log(`  ✅ Stats match actual data.`);
        }
    }

    process.exit(0);
}

main().catch(console.error);
