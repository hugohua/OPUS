/**
 * Test Database Connection
 * 
 * 功能：
 *   验证 Prisma 能否成功连接到数据库。
 * 
 * 使用方法：
 *   npx tsx scripts/test-db-connection.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import { createLogger } from '../lib/logger';

// Load env
try {
    process.loadEnvFile();
} catch (e) {
    // ignore
}

const log = createLogger('db-test');
const prisma = new PrismaClient();

async function main() {
    log.info('Testing database connection...');
    try {
        await prisma.$connect();
        log.info('✅ Successfully connected to the database!');

        // Try a simple query
        const count = await prisma.vocab.count();
        log.info({ count }, 'Vocab table count');

    } catch (error) {
        log.error({ error }, '❌ Connection failed');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
