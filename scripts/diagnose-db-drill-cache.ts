
import 'dotenv/config';
import { db } from '@/lib/db';
import { BriefingPayload } from '@/types/briefing';

const USER_ID = "cmkqwimx60000gvsxdc2jj027";

async function main() {
    console.log(`--- Diagnosing DrillCache DB for User: ${USER_ID} ---`);

    try {
        // Fetch valid caches
        const caches = await db.drillCache.findMany({
            where: {
                userId: USER_ID,
                isConsumed: false
            }
        });

        console.log(`Found ${caches.length} active DrillCache records.`);

        let errorCount = 0;
        let totalDrills = 0;
        let recordsToDelete: string[] = [];

        for (const record of caches) {
            // payload is JSON
            const payloadArray = record.payload as any as BriefingPayload[];

            if (!Array.isArray(payloadArray)) {
                console.log(`⚠️ Record ${record.id} has invalid payload structure.`);
                continue;
            }

            let recordHasError = false;

            for (const drill of payloadArray) {
                totalDrills++;
                const interact = drill.segments.find(s => s.type === 'interaction');

                if (interact && interact.task) {
                    const { options, answer_key } = interact.task;

                    // Integrity Check
                    // We use strict includes to mimic the LLM failure case
                    const isValid = options.includes(answer_key);

                    if (!isValid) {
                        console.log(`❌ DATA INTEGRITY ERROR in Record ${record.id} (Drill ID: ${(drill.meta as any)?.vocabId})`);
                        console.log(`   Key: "${answer_key}"`);
                        console.log(`   Options: ${JSON.stringify(options)}`);
                        errorCount++;
                        recordHasError = true;
                    }
                }
            }

            if (recordHasError) {
                recordsToDelete.push(record.id);
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Total Drills Scanned: ${totalDrills}`);
        console.log(`Integrity Errors Found: ${errorCount}`);

        if (recordsToDelete.length > 0) {
            console.log(`\nCleaning up ${recordsToDelete.length} corrupt records...`);
            await db.drillCache.deleteMany({
                where: {
                    id: { in: recordsToDelete }
                }
            });
            console.log(`✅ Cleanup complete. Corrupt DB records removed.`);
        } else {
            console.log(`✅ No DB corruption detected.`);
        }

    } catch (e) {
        console.error('Diagnosis failed:', e);
    } finally {
        process.exit(0);
    }
}

main().catch(console.error);
