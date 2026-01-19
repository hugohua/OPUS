/**
 * ETL Vocabulary Enrichment Script (Qwen/DeepSeek/Gemini)
 * 
 * 功能:
 *   基于 AI (Qwen-Plus/DeepSeek/Gemini) 按照 Pro Max 严格标准清洗和丰富词汇元数据。
 *   主要填充: definition_cn (简明释义), definitions (结构化释义), Scenarios (场景), Collocations (搭配).
 *   自动映射: is_toeic_core -> learningPriority (100/60).
 * 
 * 限额管理 (Gemini/通用):
 *   - 两级熔断: 429 Rate Limit -> 2 分钟冷却; Quota Exhausted -> 暂停到次日 16:30 (PT 午夜)
 *   - 指数退避: 3 次重试，间隔 5s -> 10s -> 20s
 *   - 速率节流: 每批次间隔 60 秒 (--continuous 模式)
 * 
 * 使用方法:
 *   1. Dry Run (仅生成 JSON, 不修改数据库):
 *      npx tsx scripts/etl-vocabulary-qwen.ts --dry-run
 * 
 *   2. Live Run (单批次):
 *      npx tsx scripts/etl-vocabulary-qwen.ts
 * 
 *   3. Continuous Mode (持续循环处理, 每分钟一批):
 *      npx tsx scripts/etl-vocabulary-qwen.ts --continuous
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
const BATCH_SIZE = 15;
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;  // 2 分钟冷却
const BATCH_INTERVAL_MS = 60 * 1000;            // 1 分钟间隔
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000;               // 5 秒基础退避

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
                log.debug({ word: item.word, isToeicCore: item.is_toeic_core }, 'Updated word');
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
        let def_en = "";
        if (w.definitions && Array.isArray(w.definitions)) {
            const defs = w.definitions as any[];
            const enDef = defs.find(d => d.type === 'general' || d.type === 'english' || d.type === 'oxford');
            if (enDef) def_en = enDef.text;
            else if (defs.length > 0 && defs[0].text) def_en = defs[0].text;
        }

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
        startTime: new Date()
    };

    // Main Loop
    let shouldContinue = true;
    while (shouldContinue) {
        // 1. Fetch batch
        const wordsToProcess = await fetchNextBatch();

        if (wordsToProcess.length === 0) {
            log.info('No more words need processing. All done!');
            break;
        }

        stats.batchCount++;
        log.info({
            batch: stats.batchCount,
            count: wordsToProcess.length,
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
        } else {
            stats.totalFailed += wordsToProcess.length;

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
                    continue;
                } else {
                    break;
                }
            } else if (result.circuitBreak === 'level1') {
                // Rate limit - short cooldown
                log.warn({ cooldown: formatDuration(RATE_LIMIT_COOLDOWN_MS) }, 'COOLDOWN: Rate limit triggered');
                await sleep(RATE_LIMIT_COOLDOWN_MS);
                log.info('Resuming after cooldown');
                continue;
            }
        }

        // Print progress
        const elapsed = Date.now() - stats.startTime.getTime();
        log.info({
            success: stats.totalSuccess,
            failed: stats.totalFailed,
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
