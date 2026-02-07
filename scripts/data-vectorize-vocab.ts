/**
 * 向量化脚本 (Vectorization Script)
 * 
 * 功能：
 *   为 Vocab 表中的单词生成向量 (Embeddings)，用于语义搜索。
 *   使用 "Semantic Composite Text" 策略 (Word + Business Context + Synonyms) 提高召回精准度。
 * 
 * 使用方法：
 *   npx tsx scripts/data-vectorize-vocab.ts             # 仅处理无向量的生词
 *   npx tsx scripts/data-vectorize-vocab.ts --dry-run   # 预览生成的 Payload (不消耗 Token，不写库)
 *   npx tsx scripts/data-vectorize-vocab.ts --force     # 强制重新生成所有单词向量
 * 
 * 注意：
 *   1. 环境变量要求: OPENAI_API_KEY (推荐)
 *   2. 可选环境变量: HTTPS_PROXY, EMBEDDING_MODEL_NAME (默认 text-embedding-v3/v2)
 *   3. 核心逻辑依赖 `VectorizationService`，dry-run 模式会输出预览文件到 `output/` 目录。
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';
import { VectorizationService, VocabInput } from '../lib/ai/vectorization';
import fs from 'fs';
import path from 'path';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('vectorizer');
const prisma = new PrismaClient();
const service = new VectorizationService();

// --- Configuration ---
// 阿里云限流较严，VectorizationService 内部是 batch 调用，这里控制每次从 DB 取多少
const BATCH_SIZE = 5;

// Format vector for pgvector (string format: '[1.0,2.0,3.0]')
function formatVector(vector: number[]): string {
    return `[${vector.join(',')}]`;
}

interface VocabCandidate extends VocabInput {
    id: number;
}

// Fetch batch of words needing vectorization
async function fetchCandidates(take: number, force: boolean): Promise<VocabCandidate[]> {
    let ids: { id: number }[] = [];

    if (force) {
        ids = await prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Vocab" 
            ORDER BY id ASC 
            LIMIT ${take}
        `;
    } else {
        ids = await prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Vocab" 
            WHERE embedding IS NULL 
            ORDER BY id ASC 
            LIMIT ${take}
        `;
    }

    if (ids.length === 0) return [];

    const idList = ids.map(x => x.id);

    return prisma.vocab.findMany({
        where: { id: { in: idList } },
        select: {
            id: true,
            word: true,
            definition_cn: true,
            definitions: true,
            scenarios: true,
            collocations: true,
            // [New] Fetch synonyms
            synonyms: true
        }
    });
}

// --- Main ---

async function main() {
    log.info('Starting Vectorization Script (Service Edition)...');

    const isDryRun = process.argv.includes('--dry-run');
    const isForce = process.argv.includes('--force');

    if (isDryRun) log.info('Mode: DRY-RUN (No DB updates)');
    if (isForce) log.info('Mode: FORCE (Regenerate all)');

    let totalProcessed = 0;
    const previewPayloads: any[] = [];

    // Safety break for loop
    const MAX_LOOPS = 1000;
    let loopCount = 0;

    while (true) {
        loopCount++;
        if (loopCount > MAX_LOOPS) {
            log.warn('Max loops reached. Exiting for safety.');
            break;
        }

        // 1. Fetch Candidates
        const candidates = await fetchCandidates(BATCH_SIZE, isForce);

        if (candidates.length === 0) {
            log.info('No more items to process.');
            break;
        }

        // Force mode loop protection
        if (isForce && totalProcessed > 0) {
            log.info('FORCE mode: Processed one batch. Exiting to avoid infinite loop (manual loop control required for full regen).');
            break;
        }

        log.info({ count: candidates.length, startId: candidates[0].id }, 'Fetched batch');

        // 2. Generate Embeddings via Service
        try {
            // Collect preview data for dry run
            if (isDryRun && previewPayloads.length < 10) {
                candidates.forEach(c => {
                    if (previewPayloads.length < 10) {
                        previewPayloads.push({
                            word: c.word,
                            payload: service.constructEmbeddingPayload(c)
                        });
                    }
                });
            }

            // Dry run check
            if (isDryRun) {
                log.info('DRY-RUN: Simulation Delay...');
                await new Promise(r => setTimeout(r, 500));
                log.info('DRY-RUN: Skipping AI Call & DB Update');
                totalProcessed += candidates.length;

                // [Fix] In Dry-Run, since we don't update DB, we get same candidates. 
                // Break after reasonable amount to prevent infinite loop
                if (totalProcessed >= 20) {
                    log.info('DRY-RUN: Reached limit (20 items). Exiting preview.');
                    break;
                }
                continue;
            }

            // Real Call
            const embeddings = await service.embedMany(candidates);

            log.info({ count: embeddings.length }, 'AI Embeddings Generated');

            // 3. Update DB
            let updateCount = 0;

            await Promise.all(candidates.map(async (item, index) => {
                const vector = embeddings[index];
                if (!vector) return;

                const vectorStr = formatVector(vector);

                await prisma.$executeRawUnsafe(
                    `UPDATE "Vocab" SET "embedding" = $1::vector WHERE "id" = $2`,
                    vectorStr,
                    item.id
                );
                updateCount++;
            }));

            log.info({ updated: updateCount }, 'DB Updated');

            totalProcessed += candidates.length;

        } catch (err: any) {
            log.error({ error: err.message || err }, 'Error processing batch');

            if (String(err).includes('429') || String(err).includes('Rate Limit')) {
                log.warn('Rate limit hit. Waiting 10s...');
                await new Promise(r => setTimeout(r, 10000));
            } else {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    // Save Preview if Dry Run
    if (isDryRun && previewPayloads.length > 0) {
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, 'vectorization_preview.json');
        fs.writeFileSync(outputPath, JSON.stringify(previewPayloads, null, 2), 'utf-8');
        log.info({ path: outputPath }, 'Saved preview payloads');
    }

    log.info({ totalProcessed }, 'Vectorization Complete.');
}

main()
    .catch(e => {
        log.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
