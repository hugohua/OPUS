
/**
 * Test Engine V4.0 (OMPS Unified)
 * 
 * 功能：
 *   验证 OMPS 统一选词引擎的取词逻辑。
 *   支持 Dojo (70/30) 和 Arena (30/50/20) 两种协议。
 * 
 * 使用方法：
 *   npx tsx scripts/test-engine.ts
 */

import { PrismaClient } from '@prisma/client';
import { fetchOMPSCandidates, OMPS_ARENA_CONFIG, OMPS_DOJO_CONFIG } from '../lib/services/omps-core';
import { logger } from "@/lib/logger";

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    const TEST_USER_ID = 'test-user-v3';

    logger.info({ module: "test-engine" }, "Starting Engine Test (OMPS V3)...");

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

        // 3. Test Dojo Protocol (70/30)
        const dojoResult = await fetchOMPSCandidates(TEST_USER_ID, 10, OMPS_DOJO_CONFIG);
        logger.info("--- Dojo Protocol (70/30) ---");
        logger.info(`Total: ${dojoResult.length}`);
        logger.info(`Review: ${dojoResult.filter(c => c.source === 'review').length}`);
        logger.info(`New: ${dojoResult.filter(c => c.source === 'new').length}`);

        // 4. Test Arena Protocol (30/50/20)
        const arenaResult = await fetchOMPSCandidates(TEST_USER_ID, 20, OMPS_ARENA_CONFIG);
        logger.info("--- Arena Protocol (30/50/20) ---");
        logger.info(`Total: ${arenaResult.length}`);
        logger.info(`Rescue: ${arenaResult.filter(c => c.source === 'rescue').length}`);
        logger.info(`Review: ${arenaResult.filter(c => c.source === 'review').length}`);
        logger.info(`New: ${arenaResult.filter(c => c.source === 'new').length}`);

        // 5. Top 5 words
        console.log("Top 5 Words:");
        arenaResult.slice(0, 5).forEach((c, i) => {
            console.log(`#${i + 1} [${c.word}] Source: ${c.source} | Freq: ${c.frequency_score}`);
        });

        console.log("✅ Engine test complete.");

    } catch (error) {
        logger.error({ module: "test-engine", error }, "Test failed");
    } finally {
        await prisma.$disconnect();
    }
}

main();
