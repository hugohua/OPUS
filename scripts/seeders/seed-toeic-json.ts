/**
 * TOEIC JSON Pre-processed Data Seeder Script
 * 
 * 功能:
 *   读取预先结构化的 TOEIC Part 5 JSON 题库，分批调用 AI (默认 getAIModel('etl')) 
 *   生成缺失的考点标签 (questionType, posTested, scenario, anchorText) 并在确认后入库。
 * 
 * 运行模式:
 *   1. Dry Run (仅测试前 N 个，不入库，默认输出到控制台):
 *      npx tsx scripts/seeders/seed-toeic-json.ts --test 30
 *   2. 全量 Dry Run (遍历所有未处理题目):
 *      npx tsx scripts/seeders/seed-toeic-json.ts --dry-run
 *   3. Live Run (免费层，带速率限制):
 *      npx tsx scripts/seeders/seed-toeic-json.ts --commit
 *   4. 收费版 Live Run (宽松限流，提升并发):
 *      npx tsx scripts/seeders/seed-toeic-json.ts --commit --paid
 *   5. 持续运行模式 (自动等待处理额度):
 *      npx tsx scripts/seeders/seed-toeic-json.ts --commit --continuous
 */
import { PrismaClient, QuestionType } from '@prisma/client';
import { generateObject } from 'ai';
import { getAIModel } from '../../lib/ai/client';
import { createLogger } from '../../lib/logger';
import { TOEIC_JSON_SYSTEM_PROMPT, ToeicJsonBatchResultSchema } from '../../lib/generators/etl/toeic-json-seed-prompt';
import fs from 'fs';
import path from 'path';

const log = createLogger('seed-toeic-json');
const prisma = new PrismaClient();

// [B1] 使用项目统一的 AI 工厂
const { model, modelName } = getAIModel('etl');

// --- Configuration Presets ---
const FREE_TIER_CONFIG = {
    BATCH_SIZE: 10,
    PARALLEL_REQUESTS: 1,
    RATE_LIMIT_COOLDOWN_MS: 10 * 60 * 1000,
    BATCH_INTERVAL_MS: 10 * 60 * 1000,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 10000,
    MAX_REQUESTS_PER_HOUR: 6,
    MAX_CONSECUTIVE_FAILURES: 3,
};

const PAID_TIER_CONFIG = {
    BATCH_SIZE: 20,
    PARALLEL_REQUESTS: 5,
    RATE_LIMIT_COOLDOWN_MS: 5 * 1000,
    BATCH_INTERVAL_MS: 2 * 1000,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 2000,
    MAX_REQUESTS_PER_HOUR: 360,
    MAX_CONSECUTIVE_FAILURES: 5,
};

const isPaidTier = process.argv.includes('--paid');
const CONFIG = isPaidTier ? PAID_TIER_CONFIG : FREE_TIER_CONFIG;

const {
    BATCH_SIZE,
    PARALLEL_REQUESTS,
    RATE_LIMIT_COOLDOWN_MS,
    BATCH_INTERVAL_MS,
    MAX_RETRIES,
    BASE_RETRY_DELAY_MS,
    MAX_REQUESTS_PER_HOUR,
    MAX_CONSECUTIVE_FAILURES
} = CONFIG;

// 默认使用 toeic_github_mock 作为数据源名称
const SOURCE_NAME = 'toeic_github_mock';

// 默认不写库，只有加上 --commit 才会执行入库
const isDryRun = !process.argv.includes('--commit');
const isContinuous = process.argv.includes('--continuous');

// TEXT ONLY 模式：仅测试前 N 个
const TEST_LIMIT = process.argv.includes('--test') ? parseInt(process.argv[process.argv.indexOf('--test') + 1] || '20') : 0;

// Prompt and Schema have been moved to lib/generators/etl/toeic-json-seed-prompt.ts

interface RawToeicItem {
    id: string; // "1", "2", etc.
    "1": string; // option A
    "2": string; // option B
    "3": string; // option C
    "4": string; // option D
    anwser: string; // target answer text
    question: string; // original sentence
}

// Helper: Chunk Array
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

interface RateLimitInfo {
    isRateLimit: boolean;
    isDailyQuota: boolean;
    isServiceUnavailable: boolean;
    message: string;
}

function detectRateLimitError(error: unknown): RateLimitInfo {
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    const isRateLimit = errorMsg.includes('429') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('too many requests');

    const isDailyQuota = errorMsg.includes('quota exceeded') ||
        errorMsg.includes('limit exceeded') ||
        errorMsg.includes('resource_exhausted') ||
        errorMsg.includes('quota has been exceeded');

    const isServiceUnavailable = errorMsg.includes('service unavailable') ||
        errorMsg.includes('503') ||
        errorMsg.includes('bad gateway') ||
        errorMsg.includes('502');

    return {
        isRateLimit: isRateLimit || isDailyQuota,
        isDailyQuota,
        isServiceUnavailable,
        message: error instanceof Error ? error.message : String(error)
    };
}

function getNextResetTime(): Date {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setHours(16, 30, 0, 0); // PT Midnight roughly maps to UTC+8 16:30
    if (now >= resetTime) {
        resetTime.setDate(resetTime.getDate() + 1);
    }
    return resetTime;
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface ProcessingStats {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    batchCount: number;
    startTime: Date;
    consecutiveFailures: number;
    requestsThisHour: number;
    hourStartTime: Date;
}

async function processBatchWithRetry(batch: any[], batchContext: { batchId: number; modelName: string }): Promise<{ success: boolean; processedCount: number; results?: any[]; circuitBreak?: 'level1' | 'level2' | 'service_outage' }> {
    const { batchId, modelName } = batchContext;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const mappedBatch = batch.map((q) => {
                return `
【Question ID: ${q.id}】
Sentence: ${q.processedSentence}
Options: (A) ${q["1"]} (B) ${q["2"]} (C) ${q["3"]} (D) ${q["4"]}
Target Answer: ${q.anwser}`.trim();
            }).join('\n\n');

            const prompt = `Please analyze the following TOEIC questions and extract the metadata.

${mappedBatch}`;

            const { object } = await generateObject({
                model: model,
                system: TOEIC_JSON_SYSTEM_PROMPT,
                prompt: prompt,
                schema: ToeicJsonBatchResultSchema,
                temperature: 0.1,
            });

            log.info(`[Batch ${batchId}] ✅ Model processed done (Attempt ${attempt}).`);

            return { success: true, processedCount: object.results.length, results: object.results };

        } catch (error: any) {
            const rateLimitInfo = detectRateLimitError(error);

            try {
                fs.writeFileSync('error_dump.json', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            } catch (e) { }

            if (error.name === 'TypeValidationError' || error.name === 'JSONParseError') {
                log.error({ batch: batchId, model: modelName, error: error.name }, 'FATAL SCHEMA ERROR - ABORTING BATCH');
                return { success: false, processedCount: 0 };
            }

            if (rateLimitInfo.isServiceUnavailable) {
                log.error({ batch: batchId, model: modelName, error: rateLimitInfo.message }, 'CIRCUIT BREAKER: Service Unavailable (503)');
                return { success: false, processedCount: 0, circuitBreak: 'service_outage' };
            }

            if (rateLimitInfo.isDailyQuota) {
                log.error({ batch: batchId, model: modelName, error: rateLimitInfo.message }, 'CIRCUIT BREAKER L2: Daily quota exhausted');
                return { success: false, processedCount: 0, circuitBreak: 'level2' };
            }

            if (rateLimitInfo.isRateLimit) {
                if (attempt < MAX_RETRIES) {
                    const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    log.warn({ backoff: formatDuration(backoffMs), model: modelName }, 'Rate Limit 429 detected, backing off');
                    await sleep(backoffMs);
                    continue;
                } else {
                    log.error({ batch: batchId, attempts: MAX_RETRIES, model: modelName }, 'CIRCUIT BREAKER L1: Rate limit persists after max retries');
                    return { success: false, processedCount: 0, circuitBreak: 'level1' };
                }
            }

            // Non-rate-limit error
            if (attempt < MAX_RETRIES) {
                const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                log.warn({ attempt, error: error instanceof Error ? error.message : error, backoff: formatDuration(backoffMs) }, 'Attempt failed, retrying');
                await sleep(backoffMs);
            } else {
                log.error({ batch: batchId, model: modelName, error: error instanceof Error ? error.message : String(error) }, 'All attempts failed');
                return { success: false, processedCount: 0 };
            }
        }
    }
    return { success: false, processedCount: 0 };
}


async function main() {
    console.log('='.repeat(60));
    console.log('  OPUS TOEIC JSON Data ETL Pipeline');
    console.log('='.repeat(60));
    console.log({
        mode: isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE RUN',
        tier: isPaidTier ? 'PAID (宽松限流)' : 'FREE (保守限流)',
        model: modelName,
        batchSize: BATCH_SIZE,
        parallelRequests: PARALLEL_REQUESTS,
        batchInterval: `${BATCH_INTERVAL_MS / 1000}s`,
        maxRequestsPerHour: MAX_REQUESTS_PER_HOUR,
    }, 'Configuration');

    const jsonPath = path.resolve(process.cwd(), 'books/toeic_test.json');
    if (!fs.existsSync(jsonPath)) {
        log.error(`❌ Source JSON not found at ${jsonPath}`);
        process.exit(1);
    }

    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const items: RawToeicItem[] = Object.keys(rawData).map(key => ({
        id: key,
        ...rawData[key]
    }));

    log.info(`📚 Loaded ${items.length} questions from JSON.`);

    let pendingQuestions = items.map(item => {
        // Fix formatting: Replace varying blanks with exactly 7 underscores
        const processedSentence = item.question.replace(/_{2,}/g, '_______');
        return {
            ...item,
            processedSentence
        };
    });

    if (TEST_LIMIT > 0) {
        pendingQuestions = pendingQuestions.slice(0, TEST_LIMIT);
        log.info(`🧪 TEST MODE: Processing only the first ${TEST_LIMIT} questions.`);
    } else {
        const existingRecords = await prisma.questionSeed.findMany({
            where: { source: SOURCE_NAME },
            select: { originalNumber: true }
        });
        const existingIds = new Set(existingRecords.map(r => r.originalNumber));
        pendingQuestions = pendingQuestions.filter(q => !existingIds.has(q.id));
        log.info(`📋 Filtered out existing. Found ${pendingQuestions.length} pending questions.`);

        if (pendingQuestions.length === 0) { log.info('✅ All done!'); return; }
    }

    const stats: ProcessingStats = {
        totalProcessed: 0,
        totalSuccess: 0,
        totalFailed: 0,
        batchCount: 0,
        startTime: new Date(),
        consecutiveFailures: 0,
        requestsThisHour: 0,
        hourStartTime: new Date()
    };

    let shouldContinue = true;
    while (shouldContinue && pendingQuestions.length > 0) {
        // 0. Hourly Limit Check
        const now = new Date();
        const hourElapsed = now.getTime() - stats.hourStartTime.getTime();
        if (hourElapsed >= 60 * 60 * 1000) {
            stats.requestsThisHour = 0;
            stats.hourStartTime = now;
            log.info('New hour started, request counter reset');
        }

        if (stats.requestsThisHour >= MAX_REQUESTS_PER_HOUR) {
            const waitMs = 60 * 60 * 1000 - hourElapsed;
            log.warn({ requestsThisHour: stats.requestsThisHour, limit: MAX_REQUESTS_PER_HOUR, waitDuration: formatDuration(waitMs) }, 'THROTTLE: Hourly request limit reached, waiting');
            await sleep(waitMs);
            stats.requestsThisHour = 0;
            stats.hourStartTime = new Date();
            continue;
        }

        // 1. Fetch batch
        const itemsToProcess = pendingQuestions.splice(0, BATCH_SIZE * PARALLEL_REQUESTS);

        if (itemsToProcess.length === 0) {
            log.info('No more questions need processing. All done!');
            break;
        }

        stats.batchCount++;
        stats.requestsThisHour++;
        log.info({ batchGroupId: stats.batchCount, count: itemsToProcess.length, reqsThisHour: stats.requestsThisHour }, 'Processing batch group');

        // 2. Process batch (Parallel)
        const chunks = chunkArray(itemsToProcess, BATCH_SIZE);

        const results = await Promise.all(chunks.map((chunk, index) => {
            return processBatchWithRetry(chunk, {
                batchId: stats.batchCount * 100 + index,
                modelName: `${modelName}-thread-${index + 1}`
            });
        }));

        // Aggregate Results
        let aggregatedSuccess = 0;
        let circuitBreakAction: 'level1' | 'level2' | 'service_outage' | undefined;

        for (const res of results) {
            aggregatedSuccess += res.processedCount;
            if (res.circuitBreak) {
                if (res.circuitBreak === 'service_outage') circuitBreakAction = 'service_outage';
                else if (res.circuitBreak === 'level2' && circuitBreakAction !== 'service_outage') circuitBreakAction = 'level2';
                else if (!circuitBreakAction) circuitBreakAction = 'level1';
            }

            if (res.success && res.results) {
                const processResultChunk = res.results;
                if (isDryRun) {
                    try {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const fileName = path.join(process.cwd(), 'output', `seed_toeic_json_dry_run_${timestamp}_batch_${stats.batchCount}.json`);

                        const mergedResultChunk = processResultChunk.map((r: any) => {
                            const originalItem = itemsToProcess.find(q => q.id === r.id);
                            if (!originalItem) return r;

                            return {
                                id: r.id,
                                sentence: originalItem.processedSentence,
                                options: [
                                    originalItem["1"].trim(),
                                    originalItem["2"].trim(),
                                    originalItem["3"].trim(),
                                    originalItem["4"].trim()
                                ],
                                targetAnswer: originalItem.anwser.trim(),
                                ...r
                            };
                        });

                        await fs.promises.mkdir(path.join(process.cwd(), 'output'), { recursive: true });
                        await fs.promises.writeFile(fileName, JSON.stringify(mergedResultChunk, null, 2), 'utf-8');

                        log.info({ file: fileName }, "DRY-RUN: Debug results written to output folder");
                    } catch (e: any) {
                        log.error({ error: e.message }, "Failed to write dry-run debug file");
                    }
                } else {
                    try {
                        // Map LLM output back to the original payload
                        const createPayloads = processResultChunk.map((aiResult: any) => {
                            const originalItem = itemsToProcess.find(q => q.id === aiResult.id);
                            if (!originalItem) return null;

                            // Reconstruct options array
                            const options = [
                                { text: originalItem["1"].trim(), isCorrect: originalItem["1"].trim() === originalItem.anwser.trim() },
                                { text: originalItem["2"].trim(), isCorrect: originalItem["2"].trim() === originalItem.anwser.trim() },
                                { text: originalItem["3"].trim(), isCorrect: originalItem["3"].trim() === originalItem.anwser.trim() },
                                { text: originalItem["4"].trim(), isCorrect: originalItem["4"].trim() === originalItem.anwser.trim() },
                            ];

                            return {
                                source: SOURCE_NAME, // Using a specific source flag
                                originalNumber: originalItem.id, // e.g. "1", "2"
                                questionType: aiResult.questionType as QuestionType,
                                sentence: originalItem.processedSentence,
                                targetAnswer: originalItem.anwser.trim(),
                                options: options,
                                posTested: aiResult.posTested || null,
                                scenario: aiResult.scenario || null,
                                anchorText: aiResult.anchorText || null,
                                rationale: aiResult.rationale || null,
                                difficulty: aiResult.difficulty || null
                            };
                        }).filter(Boolean);

                        if (createPayloads.length > 0) {
                            await prisma.questionSeed.createMany({
                                data: createPayloads as any[],
                                skipDuplicates: true
                            });
                            log.info(`💾 Inserted ${createPayloads.length} records into Database.`);
                        }
                    } catch (e: any) {
                        log.error({ err: e.message }, 'Failed to insert records into DB');
                    }
                }
            }
        }

        // Update Stats
        stats.totalSuccess += aggregatedSuccess;
        stats.totalProcessed += aggregatedSuccess;
        const failedCount = itemsToProcess.length - aggregatedSuccess;
        stats.totalFailed += failedCount;

        if (failedCount > 0 && aggregatedSuccess === 0) {
            stats.consecutiveFailures++;
        } else {
            stats.consecutiveFailures = 0;
        }

        // Circuit Breaker Handling
        if (circuitBreakAction === 'service_outage') {
            const waitMs = 5 * 60 * 1000;
            log.warn({ waitDuration: formatDuration(waitMs) }, 'CRITICAL PAUSE: AI Service Unavailable. Sleeping for 5 minutes...');
            if (isContinuous) { await sleep(waitMs); stats.consecutiveFailures = 0; continue; } else break;
        } else if (circuitBreakAction === 'level2') {
            const resetTime = getNextResetTime();
            const waitMs = resetTime.getTime() - Date.now();
            log.warn({ resumeAt: resetTime.toLocaleString(), waitDuration: formatDuration(waitMs) }, 'PAUSED: Waiting for quota reset');
            if (isContinuous) { await sleep(waitMs); stats.consecutiveFailures = 0; continue; } else break;
        } else if (circuitBreakAction === 'level1') {
            const cooldownMs = RATE_LIMIT_COOLDOWN_MS * (1 + stats.consecutiveFailures * 0.5);
            log.warn({ cooldown: formatDuration(cooldownMs), consecutiveFailures: stats.consecutiveFailures }, 'COOLDOWN: Rate limit triggered');
            await sleep(cooldownMs);
        } else if (stats.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            const longCooldownMs = RATE_LIMIT_COOLDOWN_MS * stats.consecutiveFailures;
            log.error({ consecutiveFailures: stats.consecutiveFailures, cooldown: formatDuration(longCooldownMs) }, 'CIRCUIT BREAKER: Too many consecutive failures');
            await sleep(longCooldownMs);
            stats.consecutiveFailures = 0;
        }

        const elapsed = Date.now() - stats.startTime.getTime();
        log.info({ success: stats.totalSuccess, failed: stats.totalFailed, consecutiveFailures: stats.consecutiveFailures, elapsed: formatDuration(elapsed) }, 'Progress');

        // 3. Continue or exit
        if (!isContinuous && pendingQuestions.length === 0) {
            shouldContinue = false;
        } else if (shouldContinue) {
            log.info({ wait: `${BATCH_INTERVAL_MS / 1000} s` }, 'Waiting before next batch');
            await sleep(BATCH_INTERVAL_MS);
        }
    }

    const totalElapsed = Date.now() - stats.startTime.getTime();
    log.info('='.repeat(60));
    log.info({
        totalBatches: stats.batchCount,
        totalSuccess: stats.totalSuccess,
        totalFailed: stats.totalFailed,
        totalDuration: formatDuration(totalElapsed)
    }, 'Final Summary');
    log.info('='.repeat(60));
}

main()
    .catch(e => { log.error({ err: e }, 'Fatal error'); process.exit(1); })
    .finally(() => prisma.$disconnect());
