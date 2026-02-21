/**
 * seed-from-pdf
 * 功能：
 *   从 books/ocr_pages 目录下的 OCR 文本片段中批量提取 TOEIC Part 5 真题并存入 QuestionSeed 表。
 *   采用 Promise.all 并发插入、自动去重、并根据锚点匹配 Vocab 词库引擎。
 * 使用方法：
 *   npx tsx scripts/seed-from-pdf.ts
 * 注意：
 *   1. 必须配置有效的 ETL_API_KEY 和 ETL_BASE_URL (通过 .env)
 *   2. 依赖 books/ocr_pages 下产生的 page_xxx.txt 文件
 */
import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { getAIModel } from '../lib/ai/client';
import { safeParse } from '../lib/ai/utils';
import { createLogger } from '../lib/logger';

// Load ENV since this is a standalone script
import 'dotenv/config';

const prisma = new PrismaClient();
const log = createLogger('seed-from-pdf');

import { PART5_SEED_SYSTEM_PROMPT, QuestionSeedSchema, QuestionSeedItemSchema } from '../lib/generators/etl/part5-seed-prompt';
// Add delay helper to avoid rate limits
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    log.info("🚀 Starting the Opus TOEIC PDF-to-DB Seeding Pipeline...");

    const PAGES_DIR = path.join(process.cwd(), 'books', 'ocr_pages');
    if (!fs.existsSync(PAGES_DIR)) {
        log.error(`❌ Directory not found: ${PAGES_DIR}`);
        log.info("💡 Please run the Python OCR script first to generate the page files.");
        process.exit(1);
    }

    const files = fs.readdirSync(PAGES_DIR)
        .filter(f => f.startsWith('page_') && f.endsWith('.txt'))
        .sort(); // Ensure chronological order

    if (files.length === 0) {
        log.error(`❌ No page files found in ${PAGES_DIR}`);
        process.exit(1);
    }

    log.info(`📚 Found ${files.length} pages to process.`);

    // Use ETL model config by default (configurable via env if needed)
    // For large batch parsing, a cheaper/faster model might be preferred, but we follow ETL
    const { model, modelName } = getAIModel('etl');

    let totalInserted = 0;

    // Concurrency Configuration
    const CONCURRENCY = parseInt(process.env.ETL_CONCURRENCY || '5', 10);
    const CHUNK_SIZE = 3;

    // Prepare Chunks
    let allChunks: string[][] = [];
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        allChunks.push(files.slice(i, i + CHUNK_SIZE));
    }

    // Determine already processed chunks by querying distinct sources
    const existingRecords = await prisma.questionSeed.findMany({
        select: { source: true },
        distinct: ['source']
    });

    // Create a Set of existing sources (e.g. 'toeic_pdf_page_004')
    const processedSources = new Set(existingRecords.map(r => r.source).filter(Boolean));

    // Filter out chunks that have already been processed
    const chunks: string[][] = [];
    for (const chunk of allChunks) {
        const sourceName = `toeic_pdf_${chunk[0].replace('.txt', '')}`;
        if (processedSources.has(sourceName)) {
            log.info(`⏭️ Skipping chunk starting with ${chunk[0]} - already exists in DB`);
        } else {
            chunks.push(chunk);
        }
    }

    if (chunks.length === 0) {
        log.info("✅ All files have already been processed and seeded into the database.");
        return;
    }

    log.info(`⚙️ Processing ${chunks.length} NEW chunks with concurrency limit of ${CONCURRENCY}...`);

    let currentIndex = 0;

    // Native Concurrency Worker
    const worker = async () => {
        let workerInserted = 0;

        while (currentIndex < chunks.length) {
            const index = currentIndex++;
            const chunkFiles = chunks[index];
            let chunkText = "";

            try {
                for (const file of chunkFiles) {
                    const filePath = path.join(PAGES_DIR, file);
                    chunkText += `\n\n--- FILE: ${file} ---\n`;
                    chunkText += fs.readFileSync(filePath, 'utf8');
                }

                // Heuristic skip
                if (!chunkText.includes('(A)') && !/1[0-4]\d\./.test(chunkText)) {
                    log.info(`⏭️ Chunk ${index + 1}/${chunks.length} [Skipped] - No Part 5 markers.`);
                    continue; // Must be continue, not return, otherwise worker dies early
                }

                log.info(`🧠 Chunk ${index + 1}/${chunks.length} [Processing] pages: ${chunkFiles[0]} - ${chunkFiles[chunkFiles.length - 1]}...`);

                const MAX_RETRIES = 3;
                let chunkSuccess = false;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        const { text } = await generateText({
                            model: model,
                            system: PART5_SEED_SYSTEM_PROMPT,
                            prompt: "Extract TOEIC Part 5 questions from this OCR text:\n\n" + chunkText.substring(0, 8000),
                            temperature: 0.1
                        });

                        const result = safeParse(text, QuestionSeedSchema, {
                            model: modelName,
                            userPrompt: 'PDF Seeding Chunk'
                        });

                        if (!result || !result.questions || result.questions.length === 0) {
                            log.info(`ℹ️ Chunk ${index + 1}/${chunks.length} [No Data]`);
                            chunkSuccess = true;
                            break; // Valid empty result, break retry loop
                        }

                        let successCount = 0;
                        const sourceName = `toeic_pdf_${chunkFiles[0].replace('.txt', '')}`;

                        // Batch Database Inserts inside a Transaction for atomicity and connection pool safety
                        await prisma.$transaction(async (tx) => {
                            for (const q of result.questions) {
                                let anchorVocabId: number | null = null;
                                if (q.anchorText) {
                                    // Case insensitive matching to handle e.g. "Implement" vs "implement"
                                    const vocab = await tx.vocab.findFirst({
                                        where: { word: { equals: q.anchorText, mode: 'insensitive' } }
                                    });
                                    if (vocab) anchorVocabId = vocab.id;
                                }

                                const existingCount = await tx.questionSeed.count({
                                    where: { sentence: q.sentence }
                                });

                                if (existingCount === 0) {
                                    await tx.questionSeed.create({
                                        data: {
                                            originalNumber: q.originalNumber,
                                            sentence: q.sentence,
                                            targetAnswer: q.targetAnswer,
                                            options: q.options as Prisma.InputJsonValue,
                                            rationale: q.rationale,
                                            anchorVocabId: anchorVocabId,
                                            anchorText: q.anchorText,
                                            questionType: q.questionType as any,
                                            posTested: q.posTested,
                                            part: 5,
                                            scenario: q.scenario,
                                            source: sourceName
                                        }
                                    });
                                    successCount++;
                                }
                            }
                        }, {
                            maxWait: 5000, // 5s max wait to connect
                            timeout: 10000 // 10s timeout for the whole transaction
                        });

                        workerInserted += successCount;
                        totalInserted += successCount;
                        log.info(`✅ Chunk ${index + 1}/${chunks.length} [Done] - Inserted ${successCount} questions.`);
                        chunkSuccess = true;
                        break; // Success, break retry loop

                    } catch (err: any) {
                        const isRateLimit = err.statusCode === 429 || err.message?.includes('429');
                        log.warn(`⚠️ Chunk ${index + 1} Attempt ${attempt} failed: ${err.message}`);

                        if (attempt < MAX_RETRIES) {
                            const delay = isRateLimit ? 30000 : 5000 * attempt;
                            log.info(`⏳ Waiting ${delay}ms before retry...`);
                            await new Promise(r => setTimeout(r, delay));
                        } else {
                            log.error(`❌ Chunk ${index + 1} permanently failed after ${MAX_RETRIES} attempts.`);
                        }
                    }
                }
            } finally {
                // Garbage Collection Hint: Release large string immediately
                chunkText = "";
            }
        }
        return workerInserted;
    };
    // Spawn Workers
    const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
    await Promise.all(workers);

    // Get total from db since memory counting in workers is scoped
    totalInserted = await prisma.questionSeed.count({
        where: {
            source: { startsWith: 'toeic_pdf_' }
        }
    });

    log.info(`🎉 Pipeline Complete! Total new QuestionSeeds inserted: ${totalInserted}`);
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
