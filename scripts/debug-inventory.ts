import 'dotenv/config';
import { redis } from '@/lib/queue/connection';
import { db } from '@/lib/db';

async function main() {
    const email = process.argv[2];

    if (email) {
        // Specific User Mode
        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        await checkUser(user.id, user.email || 'unknown');
    } else {
        // Scan Mode
        console.log('Scanning all users in Redis...');
        const keys = await redis.keys('user:*:inventory:stats');
        console.log(`Found ${keys.length} stats keys.`);

        for (const key of keys) {
            // key: user:UID:inventory:stats
            const parts = key.split(':');
            const userId = parts[1];

            // Try to resolve email
            const user = await db.user.findUnique({ where: { id: userId } });
            await checkUser(userId, user?.email || 'Unknown');
            console.log('--------------------------------------------------');
        }
    }

    process.exit(0);
}

async function checkUser(userId: string, email: string) {
    console.log(`Checking User: ${email} (${userId})`);

    // Check Stats Key
    const statsKey = `user:${userId}:inventory:stats`;
    const stats = await redis.hgetall(statsKey);

    // Scan for Drill Keys
    const pattern = `user:${userId}:mode:*:vocab:*:drills`;
    const keys = await redis.keys(pattern);

    let actualTotal = 0;
    const modeCounts: Record<string, number> = {};

    for (const key of keys) {
        const len = await redis.llen(key);
        actualTotal += len;

        const parts = key.split(':');
        const modeIndex = parts.indexOf('mode') + 1;
        const mode = parts[modeIndex];

        modeCounts[mode] = (modeCounts[mode] || 0) + len;
    }

    console.log('Stats Key:', stats);
    // console.log('Actual Mode Counts:', modeCounts);

    const statsTotal = Object.values(stats).reduce((a, b) => a + (parseInt(b) || 0), 0);
    console.log(`Stats Total: ${statsTotal} | Actual Total: ${actualTotal}`);

    if (statsTotal !== actualTotal) {
        console.log('⚠️  MISMATCH DETECTED!');
    } else {
        console.log('✅ In Sync');
    }
}

main();
