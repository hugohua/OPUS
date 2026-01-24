/**
 * 确认待处理数据量
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM "Vocab"
        WHERE definition_cn IS NOT NULL
          AND (
            jsonb_typeof(definitions) = 'array'
            OR definitions IS NULL
            OR definitions->>'general_cn' IS NULL
          )
    `;
    console.log('待处理数据总数:', Number(result[0].count));
}

main().finally(() => prisma.$disconnect());
