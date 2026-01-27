/**
 * 导入向量化结果脚本 (Batch Import Script)
 * 
 * 功能：
 *   读取阿里云 DashScope Batch Inference 的结果文件 (.jsonl)，
 *   解析并将 1536 维度的 Embedding 向量回填到数据库 Vocab 表。
 * 
 * 使用方法：
 *   npx tsx scripts/data-import-batch-embedding.ts <path-to-output-jsonl>
 * 
 * 示例：
 *   npx tsx scripts/data-import-batch-embedding.ts output/c06ea2cbxxx_success.jsonl
 * 
 * 注意：
 *   1. 必须确保 JSONL 文件中的向量维度为 1536 (与 DB vector(1536) 匹配)。
 *   2. 如果遇到 `expected 1536 dimensions` 错误，请检查导出时是否指定了 dimensions 参数。
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('importer');
const prisma = new PrismaClient();

// Format vector for pgvector (string format: '[1.0,2.0,3.0]')
function formatVector(vector: number[]): string {
    return `[${vector.join(',')}]`;
}

async function main() {
    log.info('Starting Batch Import Script...');

    // 1. Get File Path
    const filePath = process.argv[2];
    if (!filePath) {
        log.error('Missing file path argument. Usage: npx tsx scripts/data-import-batch-embedding.ts <path>');
        process.exit(1);
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        log.error({ path: absolutePath }, 'File not found');
        process.exit(1);
    }

    log.info({ path: absolutePath }, 'Reading import file');

    const fileStream = fs.createReadStream(absolutePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let successCount = 0;
    let errorCount = 0;

    // Batch processing params
    const BATCH_SIZE = 50;
    let batchDetails: { id: number; vectorStr: string }[] = [];

    // Helper to flush batch
    const flushBatch = async () => {
        if (batchDetails.length === 0) return;

        try {
            // Using transaction for batch update is safer but raw queries in loop is okay for this scale
            // To optimize, we can use a single update query with CASE or temp table, but let's stick to parallel promises for simplicity first
            // Note: Parallel writes to Postgres handles concurrency well

            await Promise.all(batchDetails.map(async (item) => {
                await prisma.$executeRawUnsafe(
                    `UPDATE "Vocab" SET "embedding" = $1::vector WHERE "id" = $2`,
                    item.vectorStr,
                    item.id
                );
            }));

            successCount += batchDetails.length;
            process.stdout.write(`\rImported ${successCount} items...`);
        } catch (err: any) {
            log.error({ error: err.message }, 'Error flushing batch');
            errorCount += batchDetails.length; // Count as error for simplicity
        } finally {
            batchDetails = [];
        }
    };

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;

            const record = JSON.parse(line);

            // Check for error response
            if (record.code && record.message) {
                log.warn({ id: record.custom_id, msg: record.message }, 'Skipping error record');
                errorCount++;
                continue;
            }

            // Parse success response
            // Structure: { custom_id, response: { body: { data: [ { embedding: [...] } ] } } }
            const customId = parseInt(record.custom_id, 10);

            // Safety check
            if (isNaN(customId)) {
                log.warn({ id: record.custom_id }, 'Invalid Custom ID');
                errorCount++;
                continue;
            }

            const responseBody = record.response?.body;
            if (!responseBody || !Array.isArray(responseBody.data) || responseBody.data.length === 0) {
                log.warn({ id: record.custom_id }, 'Invalid Response Structure');
                errorCount++;
                continue;
            }

            const embedding = responseBody.data[0].embedding;
            if (!Array.isArray(embedding)) {
                log.warn({ id: record.custom_id }, 'No embedding found');
                errorCount++;
                continue;
            }

            batchDetails.push({
                id: customId,
                vectorStr: formatVector(embedding)
            });

            if (batchDetails.length >= BATCH_SIZE) {
                await flushBatch();
            }

        } catch (e) {
            log.warn({ error: String(e) }, 'Failed to parse line');
            errorCount++;
        }
    }

    // Flush remaining
    await flushBatch();

    console.log('\n');
    log.info({ success: successCount, errors: errorCount }, 'Import Complete');
}

main()
    .catch(e => {
        log.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
