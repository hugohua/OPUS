import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { PrismaClient, Prisma } from '@prisma/client';
import { getAIModel } from '../../../lib/ai/client';
import { safeParse } from '../../../lib/ai/utils';
import { createLogger } from '../../../lib/logger';
import { z } from 'zod';
import 'dotenv/config';

const log = createLogger('pdf-seeder-core');

export interface PdfSeederConfig<T> {
    systemPrompt: string;
    schema: z.ZodType<T>;
    mapper: (data: T, tx: Prisma.TransactionClient, sourceName: string) => Promise<number>;
    heuristicFilter?: (chunkText: string) => boolean;
}

export async function runPdfSeeder<T>(config: PdfSeederConfig<T>) {
    const prisma = new PrismaClient();
    log.info("🚀 Starting the Opus TOEIC PDF-to-DB Seeding Pipeline...");

    const customDirArg = process.argv[2];
    const targetPath = customDirArg || path.join('books', 'ocr_pages');
    const PAGES_DIR = path.resolve(process.cwd(), targetPath);

    const customSourceArg = process.argv[3];
    const SOURCE_PREFIX = customSourceArg || 'toeic_pdf';

    log.info(`📂 Target Directory: ${PAGES_DIR}`);
    log.info(`🏷️  Source Prefix: ${SOURCE_PREFIX}`);

    if (!fs.existsSync(PAGES_DIR)) {
        log.error(`❌ Directory not found: ${PAGES_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(PAGES_DIR)
        .filter(f => f.startsWith('page_') && f.endsWith('.txt'))
        .sort();

    if (files.length === 0) {
        log.error(`❌ No page files found in ${PAGES_DIR}`);
        process.exit(1);
    }

    log.info(`📚 Found ${files.length} pages to process.`);

    const { model, modelName } = getAIModel('etl');
    let totalInserted = 0;

    const CONCURRENCY = parseInt(process.env.ETL_CONCURRENCY || '5', 10);
    const CHUNK_SIZE = 3;
    const PROGRESS_FILE = path.join(PAGES_DIR, '.seed-progress.txt');

    let localProgress = new Set<string>();
    if (fs.existsSync(PROGRESS_FILE)) {
        const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
        content.split('\n').filter(Boolean).forEach(line => localProgress.add(line.trim()));
    }

    let allChunks: string[][] = [];
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        allChunks.push(files.slice(i, i + CHUNK_SIZE));
    }

    const existingRecords = await prisma.questionSeed.findMany({
        select: { source: true },
        distinct: ['source']
    });

    const processedSources = new Set(existingRecords.map(r => r.source).filter(Boolean));

    const chunks: string[][] = [];
    for (const chunk of allChunks) {
        const sourceName = `${SOURCE_PREFIX}_${chunk[0].replace('.txt', '')}`;
        if (processedSources.has(sourceName) || localProgress.has(sourceName)) {
            log.info(`⏭️ Skipping chunk starting with ${chunk[0]} - already processed`);
        } else {
            chunks.push(chunk);
        }
    }

    if (chunks.length === 0) {
        log.info("✅ All files have already been processed and seeded into the database.");
        await prisma.$disconnect();
        return;
    }

    log.info(`⚙️ Processing ${chunks.length} NEW chunks with concurrency limit of ${CONCURRENCY}...`);

    let currentIndex = 0;

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

                const sourceName = `${SOURCE_PREFIX}_${chunkFiles[0].replace('.txt', '')}`;

                if (config.heuristicFilter && !config.heuristicFilter(chunkText)) {
                    log.info(`⏭️ Chunk ${index + 1}/${chunks.length} [Skipped by Heuristics].`);
                    fs.appendFileSync(PROGRESS_FILE, `${sourceName}\n`);
                    continue;
                }

                log.info(`🧠 Chunk ${index + 1}/${chunks.length} [Processing] pages: ${chunkFiles[0]} - ${chunkFiles[chunkFiles.length - 1]}...`);

                const MAX_RETRIES = 3;

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        const { text } = await generateText({
                            model: model,
                            system: config.systemPrompt,
                            prompt: "Extract questions from this OCR text:\n\n" + chunkText.substring(0, 15000),
                            temperature: 0.1
                        });

                        const result = safeParse(text, config.schema, {
                            model: modelName,
                            userPrompt: 'PDF Seeding Chunk'
                        });

                        if (!result) {
                            log.info(`ℹ️ Chunk ${index + 1}/${chunks.length} [No Data Parsed]`);
                            log.error(`RAW TEXT THAT FAILED PARSING:\n${text}`);
                            fs.appendFileSync(PROGRESS_FILE, `${sourceName}\n`);
                            break;
                        } else {
                            log.info(`✅ Successfully parsed result for chunk ${index + 1}!`);
                        }

                        let successCount = 0;

                        await prisma.$transaction(async (tx) => {
                            successCount = await config.mapper(result as T, tx, sourceName);
                        }, {
                            maxWait: 5000,
                            timeout: 10000
                        });

                        workerInserted += successCount;
                        totalInserted += successCount;
                        log.info(`✅ Chunk ${index + 1}/${chunks.length} [Done] - Inserted ${successCount} items.`);
                        fs.appendFileSync(PROGRESS_FILE, `${sourceName}\n`);
                        break;

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
                chunkText = "";
            }
        }
        return workerInserted;
    };

    const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
    await Promise.all(workers);

    const checkCurrentCount = await prisma.questionSeed.count({
        where: {
            source: { startsWith: `${SOURCE_PREFIX}_` }
        }
    });

    log.info(`🎉 Pipeline Complete! Total QuestionSeeds matching prefix: ${checkCurrentCount}, newly inserted by this run: ${totalInserted}`);
    await prisma.$disconnect();
}
