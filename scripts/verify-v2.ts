/**
 * V2 Schedule-Driven Architecture Verification Script
 * 
 * Scenarios:
 * 1. [Plan A] Cache Miss -> Deterministic Fallback (Immediate return)
 * 2. [Plan B] Cache Miss -> Emergency Job (Replenish One)
 * 3. [Plan C] Low Inventory -> Batch Job (Replenish Batch)
 * 
 * Usage:
 *   npx tsx scripts/verify-v2.ts
 */
import 'dotenv/config';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { inventory } from '@/lib/inventory';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { inventoryQueue } from '@/lib/queue';

const TEST_USER_ID = 'verify-v2-user';
const MODE = 'SYNTAX';

async function main() {
    console.log('🧪 Starting V2 Architecture Verification...');

    // --- Setup ---
    console.log('\n🧹 Cleaning up test environment...');
    await redis.del(`user:${TEST_USER_ID}:mode:${MODE}:vocab:1001:drills`);
    await redis.del(`user:${TEST_USER_ID}:mode:${MODE}:vocab:1002:drills`);
    await redis.del('buffer:replenish_drills');
    await inventoryQueue.obliterate({ force: true });

    // Ensure we have some vocab in DB to fetch (mocking db calls or ensuring data exists is hard in script without seed)
    // So we will mocking the DB calls or just check the logic units.
    // Actually, getNextDrillBatch relies on DB. Let's unit test the logic parts or rely on manual execution if DB is empty.
    // Better: Test `inventory` and `queue` interaction directly, simulating `get-next-drill` logic.

    // ==========================================
    // Scenario 1 & 2: Cache Miss -> Plan A & B
    // ==========================================
    console.log('\nTesting Scenario 1 & 2: Cache Miss (Plan A + Plan B)');

    const vocabId = 1001;

    // 1. Simulate Miss
    const drill = await inventory.popDrill(TEST_USER_ID, MODE, vocabId);

    if (drill === null) {
        console.log('✅ [Plan A] Inventory returned null (simulating Deterministic Fallback downstream)');
    } else {
        console.error('❌ [Plan A] Expected null, got drill');
    }

    // 2. Trigger Emergency manually (as getNextDrillBatch does)
    await inventory.triggerEmergency(TEST_USER_ID, MODE, vocabId);

    // 3. Check Queue (Allow some time for async add)
    await new Promise(r => setTimeout(r, 100));
    const jobs = await inventoryQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    const emergencyJob = jobs.find(j => j.name === 'replenish_one' && j.data.vocabId === vocabId);

    if (emergencyJob) {
        console.log(`✅ [Plan B] Emergency Job enqueued (ID: ${emergencyJob.id}, Priority: ${emergencyJob.opts.priority})`);
        if (emergencyJob.opts.priority === 1) {
            console.log('   -> Priority is Correct (1)');
        } else {
            console.error(`   -> Priority Mismatch! Expected 1, got ${emergencyJob.opts.priority}`);
        }
    } else {
        console.error('❌ [Plan B] Emergency Job NOT found');
    }

    // ==========================================
    // Scenario 3: Batch Aggregation (Plan C)
    // ==========================================
    console.log('\nTesting Scenario 3: Batch Aggregation (Plan C)');

    // Simulate 5 items hitting low water mark
    const lowVocabIds = [2001, 2002, 2003, 2004, 2005];

    for (const vid of lowVocabIds) {
        // Mock: Add to buffer
        await inventory.addToBuffer(TEST_USER_ID, MODE, vid);
        console.log(`   -> Added vocab ${vid} to buffer`);
    }

    // Check Buffer Count
    let bufferCount = await redis.scard('buffer:replenish_drills');
    console.log(`   -> Buffer count: ${bufferCount}`);

    // Trigger Flush
    console.log('   -> Triggering Flush...');
    await inventory.checkBufferAndFlush();

    // Check Queue for Batch Job
    console.log('   -> Waiting for job processing...');
    await new Promise(r => setTimeout(r, 1000));

    // Debug: Check Redis status
    console.log(`   -> Redis Status: ${redis.status}`);
    const keys = await redis.keys('bull:drill-inventory:*');
    console.log(`   -> Bull Keys found: ${keys.length}`);

    const counts = await inventoryQueue.getJobCounts();
    console.log(`   -> Job Counts: ${JSON.stringify(counts)}`);

    // Check ALL states
    const newJobs = await inventoryQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed', 'prioritized']);

    console.log(`   -> Found ${newJobs.length} jobs in queue:`);
    newJobs.forEach(j => {
        console.log(`      - [${j.id}] ${j.name} (${j.finishedOn ? 'Completed' : 'Pending'})`);
    });

    const batchJob = newJobs.find(j => j.name === 'replenish_batch');

    if (batchJob) {
        console.log(`✅ [Plan C] Batch Job enqueued (ID: ${batchJob.id})`);

        // For completed jobs, data is preserved
        const vids = batchJob.data.vocabIds || [];
        console.log(`   -> Payload VocabIDs: ${JSON.stringify(vids)}`);

        if (vids.length >= 5) {
            console.log('   -> Batch Size Correct (>=5)');
        } else {
            console.error(`   -> Batch Size Mismatch! Expected >=5, got ${vids.length}`);
        }
    } else {
        console.error('❌ [Plan C] Batch Job NOT found');
    }

    console.log('\nDone.');
    process.exit(0);
}

main().catch(console.error);
