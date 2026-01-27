/**
 * Test Database Connection
 *
 * Run with: npx tsx scripts/db-connection.ts
 */

import { PrismaClient } from '@prisma/client';
import { logger } from "@/lib/logger";

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    logger.info({ module: "db-connection" }, "Testing database connection...");
    try {
        await prisma.$connect();
        logger.info({ module: "db-connection" }, '✅ Successfully connected to the database!');

        // Check if we can query the vocab table
        const count = await prisma.vocab.count();
        logger.info({ module: "db-connection", count }, 'Vocab table count');

    } catch (e) {
        logger.error({ module: "db-connection", error: e }, '❌ Failed to connect to the database');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
