
import { prism } from '@/lib/db';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { parseArgs } from 'util';

// Load Env
try { process.loadEnvFile(); } catch { }

/**
 * [OMPS 仿真脚本]
 * 功能：
 *   模拟客户端连刷 5 个 Batch，可视化算法的配比逻辑。
 * 使用方法：
 *   npx tsx scripts/sim-omps.ts --userId=...
 *   npx tsx scripts/sim-omps.ts (defaults to test-user)
 */

async function main() {
    const args = parseArgs({
        options: {
            userId: { type: 'string' },
            batches: { type: 'string', default: '5' }
        }
    });

    const userId = args.values.userId || 'test-user-sim';
    const batchCount = parseInt(args.values.batches || '5');

    console.log(`\n🎰 Starting OMPS Simulation for user: [${userId}]`);
    console.log(`Desired Batches: ${batchCount}\n`);

    const allItems: any[] = [];

    for (let i = 0; i < batchCount; i++) {
        process.stdout.write(`Batch ${i + 1} fetching... `);

        // Request Batch
        const result = await getNextDrillBatch({
            userId,
            mode: 'SYNTAX',
            limit: 10,
            excludeVocabIds: allItems.map(item => (item.meta as any).vocabId).filter(id => typeof id === 'number') // Ensure valid numbers
        });

        if (result.status !== 'success' || !result.data) {
            console.error('❌ Failed:', result.message);
            continue;
        }

        const batch = result.data;
        allItems.push(...batch);

        // Analyze Batch
        const reviews = batch.filter(d => (d.meta as any).source === 'cache_v2' || (d.meta as any).source === 'unknown'); // Fallback logic might vary
        // Better way: Check if it was in UserProgress. 
        // But getNextDrillBatch doesn't return type explicitly in payload, only in candidate.
        // We can infer by checking if we have local review data? No.
        // Let's rely on 'source' or just assume ID check if we had easy access to DB.

        // Actually, let's map the 'meta' fields if we added type there.
        // In get-next-drill, we didn't explicitly add 'type' to Drill Meta payload.
        // We might want to add debug logs here or just format output simply.

        console.log(`✅ Loaded ${batch.length} items.`);
        console.log(`   IDs: ${batch.map(d => (d.meta as any).vocabId).join(', ')}`);
        console.log(`   Sources: ${batch.map(d => (d.meta as any).source).join(', ')}`);
    }

    console.log(`\n🎉 Simulation Complete. Total Items: ${allItems.length}`);
}

main();
