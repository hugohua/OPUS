/**
 * ETL Vocabulary Enrichment Script (Qwen/DeepSeek/Gemini)
 * 
 * 功能:
 *   基于 AI (Qwen-Plus/DeepSeek/Gemini) 按照 Pro Max 严格标准清洗和丰富词汇元数据。
 *   主要填充: definition_cn (简明释义), definitions (结构化释义), Scenarios (场景), Collocations (搭配).
 *   自动映射: is_toeic_core -> learningPriority (100/60).
 * 
 * 限额管理 (针对 Gemini 免费层优化):
 *   - 批次间隔: 10 分钟 (每小时 6 批，卡在免费层限额内)
 *   - 每小时上限: 最多 6 批/小时
 *   - 两级熔断: 429 Rate Limit -> 10 分钟冷却; Quota Exhausted -> 暂停到次日 16:30 (PT 午夜)
 *   - 指数退避: 3 次重试，间隔 10s -> 20s -> 40s
 *   - 连续失败保护: 连续失败 3 次后触发长时间冷却
 * 
 * 使用方法:
 *   1. Dry Run (仅生成 JSON, 不修改数据库):
 *      npx tsx scripts/etl-vocabulary-ai.ts --dry-run
 * 
 *   2. Live Run (单批次):
 *      npx tsx scripts/etl-vocabulary-ai.ts
 * 
 *   3. Continuous Mode (持续循环处理, 每分钟一批):
 *      npx tsx scripts/etl-vocabulary-ai.ts --continuous
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

// --- Configuration ---
const BATCH_SIZE = 10;
const RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;  // 10 分钟冷却 (Gemini 免费层需要更长)
const BATCH_INTERVAL_MS = 10 * 60 * 1000;        // 10 分钟间隔 (每小时 6 批，正好卡在限额内)
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 10000;               // 10 秒基础退避
const MAX_REQUESTS_PER_HOUR = 6;                 // 每小时最多 6 批 (根据实际限额调整)
const MAX_CONSECUTIVE_FAILURES = 3;              // 连续失败 3 次后长时间暂停

// --- Rate Limit Detection ---
interface RateLimitInfo {
    isRateLimit: boolean;
    isDailyQuota: boolean;
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

    return {
        isRateLimit: isRateLimit || isDailyQuota,
        isDailyQuota,
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
): Promise<{ success: boolean; processedCount: number; circuitBreak?: 'level1' | 'level2' }> {
    const { batchId, modelName } = batchContext;
    const words = wordsToProcess.map(w => w.word);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            log.info({ attempt, maxRetries: MAX_RETRIES, wordCount: aiInput.length }, 'Sending words to AI');
            const result = await aiService.enrichVocabulary(aiInput);

            log.info({ itemCount: result.items.length }, 'AI response received');

            if (isDryRun) {
                log.info('DRY-RUN: Skipping DB update');
                const resultFile = path.join(process.cwd(), 'output/etl_qwen_output.json');
                await fs.mkdir(path.dirname(resultFile), { recursive: true });
                await fs.writeFile(resultFile, JSON.stringify(result, null, 2));
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

            if (rateLimitInfo.isDailyQuota) {
                // Level 2: Daily Quota Exhausted
                log.error({
                    batch: batchId,
                    model: modelName,
                    wordCount: words.length,
                    words,
                    error: { message: rateLimitInfo.message }
                }, 'CIRCUIT BREAKER L2: Daily quota exhausted');
                return { success: false, processedCount: 0, circuitBreak: 'level2' };
            }

            if (rateLimitInfo.isRateLimit) {
                // Level 1: Short-term Rate Limit
                if (attempt < MAX_RETRIES) {
                    const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                    log.warn({ backoff: formatDuration(backoffMs) }, 'Rate Limit 429 detected, backing off');
                    await sleep(backoffMs);
                    continue;
                } else {
                    log.error({
                        batch: batchId,
                        model: modelName,
                        wordCount: words.length,
                        words,
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
                    words,
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

    log.info('═══════════════════════════════════════════════════════════');
    log.info('  ETL Vocabulary Enrichment Script');
    log.info('═══════════════════════════════════════════════════════════');
    log.info({
        mode: isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE BATCH',
        model: aiService.getModelName(),
        batchSize: BATCH_SIZE,
        rate: isContinuous ? `1 batch per ${BATCH_INTERVAL_MS / 1000}s` : undefined
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

        // 2. Process batch
        const aiInput = prepareAIInput(wordsToProcess);
        const result = await processBatchWithRetry(aiService, aiInput, wordsToProcess, isDryRun, {
            batchId: stats.batchCount,
            modelName: aiService.getModelName()
        });

        if (result.success) {
            stats.totalSuccess += result.processedCount;
            stats.totalProcessed += result.processedCount;
            stats.consecutiveFailures = 0; // 重置连续失败计数
        } else {
            stats.totalFailed += wordsToProcess.length;
            stats.consecutiveFailures++;

            // 连续失败累加冷却 (指数增长)
            if (stats.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                const longCooldownMs = RATE_LIMIT_COOLDOWN_MS * stats.consecutiveFailures;
                log.error({
                    consecutiveFailures: stats.consecutiveFailures,
                    cooldown: formatDuration(longCooldownMs)
                }, 'CIRCUIT BREAKER: Too many consecutive failures, long cooldown');
                await sleep(longCooldownMs);
                stats.consecutiveFailures = 0; // 长冷却后重置
                continue;
            }

            // Handle Circuit Breaker
            if (result.circuitBreak === 'level2') {
                // Daily quota exhausted - pause until reset
                const resetTime = getNextResetTime();
                const waitMs = resetTime.getTime() - Date.now();
                log.warn({
                    resumeAt: resetTime.toLocaleString(),
                    waitDuration: formatDuration(waitMs)
                }, 'PAUSED: Waiting for quota reset');

                if (isContinuous) {
                    await sleep(waitMs);
                    log.info('Resuming after quota reset');
                    stats.consecutiveFailures = 0;
                    continue;
                } else {
                    break;
                }
            } else if (result.circuitBreak === 'level1') {
                // Rate limit - cooldown with progressive backoff
                const cooldownMs = RATE_LIMIT_COOLDOWN_MS * (1 + stats.consecutiveFailures * 0.5);
                log.warn({
                    cooldown: formatDuration(cooldownMs),
                    consecutiveFailures: stats.consecutiveFailures
                }, 'COOLDOWN: Rate limit triggered');
                await sleep(cooldownMs);
                log.info('Resuming after cooldown');
                continue;
            }
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
    log.info('═══════════════════════════════════════════════════════════');
    log.info({
        totalBatches: stats.batchCount,
        totalSuccess: stats.totalSuccess,
        totalFailed: stats.totalFailed,
        totalDuration: formatDuration(totalElapsed)
    }, 'Final Summary');
    log.info('═══════════════════════════════════════════════════════════');
}

main()
    .catch((e) => {
        log.error({ error: e }, 'Fatal error');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
