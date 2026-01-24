
/**
 * Backfill Frequency Score
 * 
 * 功能：
 *   基于 abceed_rank 和 learningPriority 计算并填充 frequency_score。
 *   策略：
 *     1. 有 Rank: max(10, 100 - floor(rank/100))
 *     2. 无 Rank 但 Core: 40
 *     3. 其他: 10
 * 
 * 使用方法：
 *   npx tsx scripts/data-backfill-frequency.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import { logger } from "@/lib/logger";

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    logger.info({ module: "db-backfill" }, "开始回填 frequency_score...");

    try {
        // 1. Tier A: Calculate from abceed_rank (Using Raw SQL for performance)
        // Formula: 100 - (rank / 100), min 10.
        // Explicitly cast raw numbers to integer to satisfy Postgres strict typing if needed, 
        // but standard integer math works fine.
        const resultTierA = await prisma.$executeRawUnsafe(`
      UPDATE "Vocab"
      SET "frequency_score" = GREATEST(10, 100 - FLOOR("abceed_rank" / 100))
      WHERE "abceed_rank" IS NOT NULL;
    `);
        logger.info({ module: "db-backfill", count: resultTierA }, "✅ Tier A (Rank-based) updated");

        // 2. Tier B: Core words (Priority >= 60) without rank
        const resultTierB = await prisma.vocab.updateMany({
            where: {
                abceed_rank: null,
                learningPriority: {
                    gte: 60
                }
            },
            data: {
                frequency_score: 40
            }
        });
        logger.info({ module: "db-backfill", count: resultTierB.count }, "✅ Tier B (Core fallback) updated to 40");

        // 3. Tier C: Long tail words without rank and low priority
        const resultTierC = await prisma.vocab.updateMany({
            where: {
                abceed_rank: null,
                learningPriority: {
                    lt: 60
                }
            },
            data: {
                frequency_score: 10
            }
        });
        logger.info({ module: "db-backfill", count: resultTierC.count }, "✅ Tier C (Long-tail fallback) updated to 10");

        logger.info({ module: "db-backfill" }, "🎉 回填完成！");

    } catch (error) {
        logger.error({ module: "db-backfill", error }, "❌ 回填失败");
    } finally {
        await prisma.$disconnect();
    }
}

main();
