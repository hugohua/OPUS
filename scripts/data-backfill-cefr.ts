/**
 * Backfill CEFR Level Script
 * 
 * 功能：
 *   为新导入的特定两本书（特急系列）批量补充 cefrLevel 字段。
 *   策略：
 *     - 銀のフレーズ (tokyu_gin_phrase): 基础到中级词汇，设为 "A2"
 *     - 黒のフレーズ (tokyu_kuro_phrase): 高级词汇，设为 "C1"
 * 
 * 使用方法：
 *   npx tsx scripts/data-backfill-cefr.ts
 */

import { PrismaClient } from '@prisma/client';
import { logger } from "@/lib/logger";

try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    logger.info({ module: "db-backfill-cefr" }, "开始回填特急系列的 cefrLevel...");

    try {
        // 1. 回填 銀のフレーズ (tokyu_gin_phrase) -> A2
        const resultGin = await prisma.vocab.updateMany({
            where: {
                tags: {
                    has: 'book:tokyu_gin_phrase'
                },
                cefrLevel: null
            },
            data: {
                cefrLevel: 'A2'
            }
        });
        logger.info({ module: "db-backfill-cefr", count: resultGin.count }, "✅ 銀のフレーズ (tokyu_gin_phrase) 的无 CEFR 词汇已标注为 A2");

        // 2. 回填 黒のフレーズ (tokyu_kuro_phrase) -> C1
        const resultKuro = await prisma.vocab.updateMany({
            where: {
                tags: {
                    has: 'book:tokyu_kuro_phrase'
                },
                cefrLevel: null
            },
            data: {
                cefrLevel: 'C1'
            }
        });
        logger.info({ module: "db-backfill-cefr", count: resultKuro.count }, "✅ 黒のフレーズ (tokyu_kuro_phrase) 的无 CEFR 词汇已标注为 C1");

        logger.info({ module: "db-backfill-cefr" }, "🎉 回填完成！");

    } catch (error) {
        logger.error({ module: "db-backfill-cefr", error }, "❌ 回填失败");
    } finally {
        await prisma.$disconnect();
    }
}

main();
