
/**
 * Test Engine V3.0
 * 
 * 功能：
 *   验证 HybridSelector 的取词逻辑。
 *   主要验证 "New Acquisition" 的 Survival Sort (Verb > Freq > Length)。
 * 
 * 使用方法：
 *   npx tsx scripts/test-engine.ts
 */

import { PrismaClient } from '@prisma/client';
import { HybridSelector } from '../lib/engine/hybrid-selector';
import { logger } from "@/lib/logger";

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    const TEST_USER_ID = 'test-user-v3';

    logger.info({ module: "test-engine" }, "Starting Engine Test...");

    try {
        // 1. Ensure User exists
        let user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: TEST_USER_ID,
                    email: 'test-v3@example.com',
                    name: 'Test Logic V3',
                    password: 'hashed-password-placeholder',
                }
            });
            logger.info("Created dummy user: " + TEST_USER_ID);
        }

        // 2. Clear Progress (Reset State)
        await prisma.userProgress.deleteMany({ where: { userId: TEST_USER_ID } });
        logger.info("Cleared user progress");

        // 3. Call Hybrid Selector
        const result = await HybridSelector.selectWords(TEST_USER_ID);

        // 4. Verification
        logger.info("------------------------------------------------");
        logger.info(`Rescue: ${result.rescue.length} (Expected 0)`);
        logger.info(`Review: ${result.review.length} (Expected 0)`);
        logger.info(`New:    ${result.new.length}    (Expected 20)`);
        logger.info("------------------------------------------------");

        // 5. Check Sorting Logic
        // Expect: Verbs first, High Freq first

        // Check first 5 words
        console.log("Top 5 New Words:");
        result.new.slice(0, 5).forEach((w, i) => {
            console.log(`#${i + 1} [${w.word}] POS: ${w.partOfSpeech} | Freq: ${w.frequency_score} | Len: ${w.word.length}`);
        });

        const first = result.new[0];
        if (first && !first.partOfSpeech?.includes('v.')) {
            console.warn("⚠️ Warning: First word is NOT a verb! Check sorting logic.");
            if (result.new.some(w => w.partOfSpeech?.includes('v.'))) {
                console.error("❌ Error: There are verbs in the list but top 1 is not verb.");
            } else {
                console.log("ℹ️ Note: No verbs found in intake pool?");
            }
        } else {
            console.log("✅ First word is a verb (or list empty).");
        }

    } catch (error) {
        logger.error({ module: "test-engine", error }, "Test failed");
    } finally {
        await prisma.$disconnect();
    }
}

main();
