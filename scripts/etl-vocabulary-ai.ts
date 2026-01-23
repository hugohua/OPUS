/**
 * ETL Vocabulary Enrichment Script (Qwen/DeepSeek/Gemini)
 * 
 * 功能:
 *   基于 AI (Qwen-Plus/DeepSeek/Gemini) 按照 Pro Max 严格标准清洗和丰富词汇元数据。
 *   主要填充: definition_cn (简明释义), definitions (结构化释义), Scenarios (场景), Collocations (搭配).
 *   自动映射: is_toeic_core -> learningPriority (100/60).
 * 
 * 配置模式:
 *   - 免费版 (默认): 保守限流，适合 Gemini 免费层 (10 分钟间隔，每小时 6 批)
 *   - 收费版 (--paid): 宽松限流，适合 Qwen/DeepSeek/付费 API (2 秒间隔，每小时 360 批)
 * 
 * 使用方法:
 *   1. Dry Run (仅生成 JSON, 不修改数据库):
 *      npx tsx scripts/etl-vocabulary-ai.ts --dry-run
 * 
 *   2. Live Run - 免费版 (单批次):
 *      npx tsx scripts/etl-vocabulary-ai.ts
 * 
 *   3. Live Run - 收费版 (单批次):
 *      npx tsx scripts/etl-vocabulary-ai.ts --paid
 * 
 *   4. Continuous Mode - 免费版 (持续循环, 10 分钟一批):
 *      npx tsx scripts/etl-vocabulary-ai.ts --continuous
 * 
 *   5. Continuous Mode - 收费版 (持续循环, 2 秒一批, 并发 2):
 *      npx tsx scripts/etl-vocabulary-ai.ts --continuous --paid
 * 
 * 环境变量 (.env):
 *   - DATABASE_URL: 数据库连接
 *   - OPENAI_API_KEY / GOOGLE_AI_API_KEY: AI 服务 Key
 *   - AI_MODEL_NAME: 模型名称 (默认 qwen-plus)
 */

import { PrismaClient } from '../generated/prisma/client';
import { VocabularyAIService } from '../lib/ai/VocabularyAIService';
import { calculatePriority } from '../lib/ai/utils';
import { createLogger } from '../lib/logger';
import type { VocabularyInput } from '../types/ai';
import fs from 'fs/promises';
import path from 'path';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

// --- Logger ---
const log = createLogger('etl');

// --- Configuration Presets ---
// 免费版配置 (Gemini Free Tier)
const FREE_TIER_CONFIG = {
    BATCH_SIZE: 10,
    PARALLEL_REQUESTS: 1,        // 免费版不支持并发
    RATE_LIMIT_COOLDOWN_MS: 10 * 60 * 1000,
    BATCH_INTERVAL_MS: 10 * 60 * 1000,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 10000,
    MAX_REQUESTS_PER_HOUR: 6,
    MAX_CONSECUTIVE_FAILURES: 3,
};

// 收费版配置 (Qwen/DeepSeek/Gemini Paid)
const PAID_TIER_CONFIG = {
    BATCH_SIZE: 8,              // 提升 Batch 到 10
    PARALLEL_REQUESTS: 8,        // 并发请求数 (2线程)
    RATE_LIMIT_COOLDOWN_MS: 5 * 1000,
    BATCH_INTERVAL_MS: 2 * 1000, // 2s 间隔
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 2000,
    MAX_REQUESTS_PER_HOUR: 360,  // 每小时 360 批
    MAX_CONSECUTIVE_FAILURES: 5,
};

// 根据命令行参数选择配置
const isPaidTier = process.argv.includes('--paid');
const CONFIG = isPaidTier ? PAID_TIER_CONFIG : FREE_TIER_CONFIG;

// 解构配置供后续使用
const {
    BATCH_SIZE,
    PARALLEL_REQUESTS,
    RATE_LIMIT_COOLDOWN_MS,
    BATCH_INTERVAL_MS,
    MAX_RETRIES,
    BASE_RETRY_DELAY_MS,
    MAX_REQUESTS_PER_HOUR,
    MAX_CONSECUTIVE_FAILURES,
} = CONFIG;

// Helper: Chunk Array
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

// --- Rate Limit Detection ---
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

// --- Circuit Breaker ---
function getNextResetTime(): Date {
    // Gemini 在 PT 午夜重置 ≈ UTC+8 16:00
    const now = new Date();
    const resetTime = new Date(now);

    // 设置为今天 16:30 (UTC+8)
    resetTime.setHours(16, 30, 0, 0);

    // 如果已过 16:30，则设置为明天
    if (now >= resetTime) {
        resetTime.setDate(resetTime.getDate() + 1);
    }

    return resetTime;
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// --- Stats Tracking ---
interface ProcessingStats {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    batchCount: number;
    startTime: Date;
    consecutiveFailures: number;      // 连续失败计数
    requestsThisHour: number;         // 本小时请求数
    hourStartTime: Date;              // 本小时开始时间
}

const prisma = new PrismaClient();

// --- Process Single Batch with Retry ---
async function processBatchWithRetry(
    aiService: VocabularyAIService,
    aiInput: VocabularyInput[],
    wordsToProcess: any[],
    isDryRun: boolean,
    batchContext: { batchId: number; modelName: string }
): Promise<{ success: boolean; processedCount: number; circuitBreak?: 'level1' | 'level2' | 'service_outage' }> {
    const { batchId, modelName } = batchContext;
    const words = wordsToProcess.map(w => w.word);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log({ attempt, maxRetries: MAX_RETRIES, wordCount: aiInput.length, model: modelName }, 'Sending words to AI');
            const result = await aiService.enrichVocabulary(aiInput);

            log.info({ itemCount: result.items.length, model: modelName }, 'AI response received');

            if (isDryRun) {
                log.info('DRY-RUN: Skipping DB update');
                const resultFile = path.join(process.cwd(), `output/etl_${modelName}_output.json`);
                await fs.mkdir(path.dirname(resultFile), { recursive: true });
                await fs.writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');
                log.info({ file: resultFile }, 'DRY-RUN: Results written to file');
                return { success: true, processedCount: result.items.length };
            }

            // Update Database
            let updateCount = 0;
            for (const item of result.items) {
                const original = wordsToProcess.find((w: any) => w.word === item.word);
                if (!original) continue;

                const finalCollocations = item.collocations.map(col => ({
                    text: col.text,
                    trans: col.trans,
                    source: col.origin === 'abceed' ? 'abceed' : 'ai',
                    weight: col.origin === 'abceed' ? 100 : 50
                }));

                // 使用靶心分层策略计算优先级
                const original_cefr = wordsToProcess.find((w: any) => w.word === item.word)?.cefrLevel;
                const learningPriority = calculatePriority(item.is_toeic_core, original_cefr);

                // Map string priority to Enum
                let vocabPriority: any = 'SUPPORT'; // Default
                if (item.priority === 'CORE') vocabPriority = 'CORE';
                if (item.priority === 'NOISE') vocabPriority = 'NOISE';

                await prisma.vocab.update({
                    where: { id: original.id },
                    data: {
                        definition_cn: item.definition_cn,
                        definitions: item.definitions as any,
                        is_toeic_core: item.is_toeic_core,
                        learningPriority: learningPriority,
                        scenarios: item.scenarios,
                        collocations: finalCollocations as any,
                        // Pro Max Fields
                        priority: vocabPriority,
                        word_family: item.word_family as any,
                        confusing_words: item.confusing_words,
                        synonyms: item.synonyms,
                    },
                });
                updateCount++;
                log.info({ word: item.word, priority: vocabPriority, isToeicCore: item.is_toeic_core }, '✓ Word updated');
            }

            return { success: true, processedCount: updateCount };

        } catch (error) {
            const rateLimitInfo = detectRateLimitError(error);

            if (rateLimitInfo.isServiceUnavailable) {
                // Critical: Service Outage (503/502)
                log.error({
                    batch: batchId,
                    model: modelName,
                    error: { message: rateLimitInfo.message }
                }, 'CIRCUIT BREAKER: Service Unavailable (503) detected');
                return { success: false, processedCount: 0, circuitBreak: 'service_outage' };
            }

            if (rateLimitInfo.isDailyQuota) {
                // Level 2: Daily Quota Exhausted
                log.error({
                    batch: batchId,
                    model: modelName,
                    wordCount: words.length,
                    words: words.join(', '),
                    error: { message: rateLimitInfo.message }
                }, 'CIRCUIT BREAKER L2: Daily quota exhausted');
                return { success: false, processedCount: 0, circuitBreak: 'level2' };
            }

            if (rateLimitInfo.isRateLimit) {
                // Level 1: Short-term Rate Limit
                if (attempt < MAX_RETRIES) {
                    const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    log.warn({ backoff: formatDuration(backoffMs), model: modelName }, 'Rate Limit 429 detected, backing off');
                    await sleep(backoffMs);
                    continue;
                } else {
                    log.error({
                        batch: batchId,
                        model: modelName,
                        wordCount: words.length,
                        words: words.join(', '),
                        attempts: MAX_RETRIES
                    }, 'CIRCUIT BREAKER L1: Rate limit persists after max retries');
                    return { success: false, processedCount: 0, circuitBreak: 'level1' };
                }
            }

            // Non-rate-limit error
            if (attempt < MAX_RETRIES) {
                const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                log.warn({
                    attempt,
                    error: error instanceof Error ? error.message : error,
                    backoff: formatDuration(backoffMs)
                }, 'Attempt failed, retrying');
                await sleep(backoffMs);
            } else {
                log.error({
                    batch: batchId,
                    model: modelName,
                    wordCount: words.length,
                    words: words.join(', '),
                    error: error instanceof Error ? {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    } : String(error)
                }, 'All attempts failed');
                return { success: false, processedCount: 0 };
            }
        }
    }

    return { success: false, processedCount: 0 };
}

// --- Fetch Next Batch ---
async function fetchNextBatch() {
    return prisma.vocab.findMany({
        where: {
            definition_cn: null,
        },
        take: BATCH_SIZE,
        select: {
            id: true,
            word: true,
            definitions: true,
            definition_jp: true,
            collocations: true,
            cefrLevel: true, // 用于优先级计算
        },
    });
}

// --- Prepare AI Input ---
function prepareAIInput(wordsToProcess: any[]): VocabularyInput[] {
    return wordsToProcess.map((w: any) => {
        // 解析 definitions：使用最新的对象格式 { business_cn, general_cn }
        let def_en = "";
        if (w.definitions && typeof w.definitions === 'object' && !Array.isArray(w.definitions)) {
            // 新格式: { business_cn, general_cn }
            const defs = w.definitions as { business_cn?: string; general_cn?: string };
            def_en = defs.general_cn || defs.business_cn || "";
        }

        // Col JP: Extract abceed collocations
        let col_jp: any[] = [];
        if (w.collocations && Array.isArray(w.collocations)) {
            col_jp = (w.collocations as any[]).filter(c => c.source === 'abceed');
        }

        return {
            word: w.word,
            def_en: def_en,
            def_jp: w.definition_jp,
            col_jp: col_jp
        };
    });
}

// --- Main ---
async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const isContinuous = process.argv.includes('--continuous');

    const aiService = new VocabularyAIService();

    console.log('='.repeat(60));
    console.log('  ETL Vocabulary Enrichment Script');
    console.log('='.repeat(60));
    console.log({
        mode: isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE BATCH',
        tier: isPaidTier ? 'PAID (宽松限流)' : 'FREE (保守限流)',
        model: aiService.getModelName(),
        batchSize: BATCH_SIZE,
        parallelRequests: PARALLEL_REQUESTS,
        batchInterval: `${BATCH_INTERVAL_MS / 1000}s`,
        maxRequestsPerHour: MAX_REQUESTS_PER_HOUR,
    }, 'Configuration');

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

    // Main Loop
    let shouldContinue = true;
    while (shouldContinue) {
        // 0. 检查每小时请求上限
        const now = new Date();
        const hourElapsed = now.getTime() - stats.hourStartTime.getTime();
        if (hourElapsed >= 60 * 60 * 1000) {
            // 新的一小时，重置计数器
            stats.requestsThisHour = 0;
            stats.hourStartTime = now;
            log.info('New hour started, request counter reset');
        }

        if (stats.requestsThisHour >= MAX_REQUESTS_PER_HOUR) {
            const waitMs = 60 * 60 * 1000 - hourElapsed;
            log.warn({
                requestsThisHour: stats.requestsThisHour,
                limit: MAX_REQUESTS_PER_HOUR,
                waitDuration: formatDuration(waitMs)
            }, 'THROTTLE: Hourly request limit reached, waiting');
            await sleep(waitMs);
            stats.requestsThisHour = 0;
            stats.hourStartTime = new Date();
            continue;
        }

        // 1. Fetch batch
        const wordsToProcess = await fetchNextBatch();

        if (wordsToProcess.length === 0) {
            log.info('No more words need processing. All done!');
            break;
        }

        stats.batchCount++;
        stats.requestsThisHour++;
        log.info({
            batch: stats.batchCount,
            count: wordsToProcess.length,
            requestsThisHour: stats.requestsThisHour,
            words: wordsToProcess.map(w => w.word).join(', ')
        }, 'Processing batch');

        // 2. Process batch (Parallel)
        const subBatchSize = Math.ceil(wordsToProcess.length / PARALLEL_REQUESTS);
        const chunks = chunkArray(wordsToProcess, subBatchSize);

        log.info({
            parallelRequests: chunks.length,
            wordsPerRequest: subBatchSize
        }, 'Starting parallel processing');

        const results = await Promise.all(chunks.map((chunk, index) => {
            const aiInput = prepareAIInput(chunk);
            return processBatchWithRetry(aiService, aiInput, chunk, isDryRun, {
                batchId: stats.batchCount,
                modelName: `${aiService.getModelName()}-thread-${index + 1}`
            });
        }));

        // Aggregate Results
        let aggregatedSuccess = 0;
        let circuitBreakAction: 'level1' | 'level2' | 'service_outage' | undefined;

        for (const res of results) {
            aggregatedSuccess += res.processedCount;
            if (res.circuitBreak) {
                // Priority: service_outage > level2 > level1
                if (res.circuitBreak === 'service_outage') circuitBreakAction = 'service_outage';
                else if (res.circuitBreak === 'level2' && circuitBreakAction !== 'service_outage') circuitBreakAction = 'level2';
                else if (!circuitBreakAction) circuitBreakAction = 'level1';
            }
        }

        // Update Stats
        stats.totalSuccess += aggregatedSuccess;
        stats.totalProcessed += aggregatedSuccess;
        const failedCount = wordsToProcess.length - aggregatedSuccess;
        stats.totalFailed += failedCount;

        if (failedCount > 0 && aggregatedSuccess === 0) {
            stats.consecutiveFailures++;
        } else {
            stats.consecutiveFailures = 0;
        }

        // Circuit Breaker Handling
        if (circuitBreakAction === 'service_outage') {
            const waitMs = 5 * 60 * 1000; // 5 minutes
            log.warn({
                waitDuration: formatDuration(waitMs)
            }, 'CRITICAL PAUSE: AI Service Unavailable. Sleeping for 5 minutes...');

            if (isContinuous) {
                await sleep(waitMs);
                stats.consecutiveFailures = 0; // Reset failures to give it a fresh try
                continue;
            } else {
                break;
            }
        } else if (circuitBreakAction === 'level2') {
            const resetTime = getNextResetTime();
            const waitMs = resetTime.getTime() - Date.now();
            log.warn({
                resumeAt: resetTime.toLocaleString(),
                waitDuration: formatDuration(waitMs)
            }, 'PAUSED: Waiting for quota reset');
            if (isContinuous) {
                await sleep(waitMs);
                stats.consecutiveFailures = 0;
                continue;
            } else {
                break;
            }
        } else if (circuitBreakAction === 'level1') {
            // Rate limit cooldown
            const cooldownMs = RATE_LIMIT_COOLDOWN_MS * (1 + stats.consecutiveFailures * 0.5);
            log.warn({
                cooldown: formatDuration(cooldownMs),
                consecutiveFailures: stats.consecutiveFailures
            }, 'COOLDOWN: Rate limit triggered');
            await sleep(cooldownMs);
        } else if (stats.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            const longCooldownMs = RATE_LIMIT_COOLDOWN_MS * stats.consecutiveFailures;
            log.error({
                consecutiveFailures: stats.consecutiveFailures,
                cooldown: formatDuration(longCooldownMs)
            }, 'CIRCUIT BREAKER: Too many consecutive failures');
            await sleep(longCooldownMs);
            stats.consecutiveFailures = 0;
        }

        // Print progress
        const elapsed = Date.now() - stats.startTime.getTime();
        log.info({
            success: stats.totalSuccess,
            failed: stats.totalFailed,
            consecutiveFailures: stats.consecutiveFailures,
            elapsed: formatDuration(elapsed)
        }, 'Progress');

        // 3. Continue or exit
        if (!isContinuous) {
            shouldContinue = false;
        } else {
            // Rate limiting: wait before next batch
            log.info({ wait: `${BATCH_INTERVAL_MS / 1000}s` }, 'Waiting before next batch');
            await sleep(BATCH_INTERVAL_MS);
        }
    }

    // Final Summary
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
    .catch((e) => {
        log.error({ error: e }, 'Fatal error');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
