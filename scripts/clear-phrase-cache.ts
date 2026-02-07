
import { redis } from '@/lib/queue/connection';
import { createLogger } from '@/lib/logger';

const log = createLogger('scripts:clear-cache');

async function main() {
    const userId = 'user_2sYQA9vC8j7lK4m3nO5rP6qT9uV'; // Replace with actual user ID if known, or scan all
    // Ideally we scan, but for now let's assume we clear for all or specific pattern if possible.
    // The previous debug output shows user ID might be available, or we check keys pattern.

    console.log('🧹 Clearing PHRASE mode inventory...');

    // Pattern: user:*:mode:PHRASE:vocab:*:drills
    const stream = redis.scanStream({
        match: 'user:*:mode:PHRASE:vocab:*:drills'
    });

    let keysToDelete: string[] = [];

    for await (const keys of stream) {
        if (keys.length) {
            keysToDelete.push(...keys);
        }
    }

    if (keysToDelete.length > 0) {
        console.log(`Found ${keysToDelete.length} stale drill keys.`);
        await redis.del(...keysToDelete);
        console.log('✅ Deleted stale drills.');
    } else {
        console.log('No stale drills found.');
    }

    console.log('🎉 Done.');
    process.exit(0);
}

main();
