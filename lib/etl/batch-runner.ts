import { createLogger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

const log = createLogger('etl-runner');

// --- Configuration Types ---

export interface EtlConfig {
    BATCH_SIZE: number;
    PARALLEL_REQUESTS: number;
    RATE_LIMIT_COOLDOWN_MS: number;
    BATCH_INTERVAL_MS: number;
    MAX_RETRIES: number;
    BASE_RETRY_DELAY_MS: number;
    MAX_REQUESTS_PER_HOUR: number;
    MAX_CONSECUTIVE_FAILURES: number;
}

export const FREE_TIER_CONFIG: EtlConfig = {
    BATCH_SIZE: 10,
    PARALLEL_REQUESTS: 1,
    RATE_LIMIT_COOLDOWN_MS: 10 * 60 * 1000,
    BATCH_INTERVAL_MS: 10 * 60 * 1000,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 10000,
    MAX_REQUESTS_PER_HOUR: 6,
    MAX_CONSECUTIVE_FAILURES: 3,
};

export const PAID_TIER_CONFIG: EtlConfig = {
    BATCH_SIZE: 10,
    PARALLEL_REQUESTS: 6,
    RATE_LIMIT_COOLDOWN_MS: 5 * 1000,
    BATCH_INTERVAL_MS: 2 * 1000,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY_MS: 2000,
    MAX_REQUESTS_PER_HOUR: 360,
    MAX_CONSECUTIVE_FAILURES: 5,
};

// --- Job Types ---

export interface EtlBatchResult {
    successCount: number;
    failedCount: number;
    circuitBreak?: 'level1' | 'level2' | 'service_outage';
    debugInfo?: {
        systemPrompt: string;
        userPrompt: string;
        rawResult: string;
        batchId: string;
    }
}


export interface EtlJobOptions<T, C = any> {
    jobName: string;
    tier: 'free' | 'paid';
    fetchBatch: (batchSize: number, isDryRun: boolean) => Promise<T[]>;
    processBatch: (items: T[], isDryRun: boolean, batchIndex: number, context?: C) => Promise<EtlBatchResult>;
    getTotalCount?: (isDryRun: boolean) => Promise<number>;
    isDryRun?: boolean;
    isContinuous?: boolean;
    context?: C;
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
    initialTotal?: number;
}

// --- Utils ---

function getNextResetTime(): Date {
    const now = new Date();
    const resetTime = new Date(now);
    // Gemini/OpenAI typically reset quotas around UTC+8 16:00-17:00 or midnight UTC
    // Setting conservatively to next day 4:30 PM UTC+8
    resetTime.setHours(16, 30, 0, 0);
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
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

function getProgressBar(current: number, total: number, width = 20): string {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((width * current) / total);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}%`;
}

async function writeDebugLog(jobName: string, info: NonNullable<EtlBatchResult['debugInfo']>) {
    // ... (existing implementation)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `output/${jobName}_dry_run_${timestamp}_${info.batchId}.txt`;

    const fileContent = `system prompt:
${info.systemPrompt}

user prompt:
${info.userPrompt}

result:
${info.rawResult}

---------------------------------------------
Please copy the content above and send it to an LLM with the following prompt:

"""
# Role
你是一位精通 Prompt Engineering 的专家，擅长优化 LLM 的指令遵循能力和内容生成质量。

# Objective
评估用户提供的 System Prompt、User Prompt 以及 LLM 生成的 Result。
请分析 System Prompt 是否最优，生成的内容是否完全符合约束，并给出优化建议。

# Output Format (Markdown)
## 评分 (1-10分)
给出综合评分。

## 问题分析
指出生成内容中存在的问题（如未遵循的约束、逻辑漏洞、格式错误等）。

## 优化建议
针对 System Prompt 给出具体的修改建议（中文），如果是 Prompt 结构问题，请提供优化后的 Prompt 片段。
"""
`;

    try {
        await fs.mkdir('output', { recursive: true });
        await fs.writeFile(fileName, fileContent, 'utf-8');
        log.info({ file: fileName }, "DRY-RUN: Debug file written");
    } catch (e) {
        log.error({ error: e }, "Failed to write debug file");
    }
}

// --- Main Runner ---

export async function runEtlJob<T, C = any>(options: EtlJobOptions<T, C>) {
    const { jobName, tier, fetchBatch, processBatch, getTotalCount, isDryRun = false, isContinuous = false, context } = options;
    const config = tier === 'paid' ? PAID_TIER_CONFIG : FREE_TIER_CONFIG;

    // Structured Start Log
    log.info({
        jobName,
        mode: isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE BATCH',
        tier: tier === 'paid' ? 'PAID' : 'FREE',
        config: {
            batchSize: config.BATCH_SIZE,
            parallelRequest: config.PARALLEL_REQUESTS,
            interval: `${config.BATCH_INTERVAL_MS / 1000}s`
        }
    }, 'Starting ETL Job');

    // Stats initialization
    const initialStats: ProcessingStats = {
        totalProcessed: 0,
        totalSuccess: 0,
        totalFailed: 0,
        batchCount: 0,
        startTime: new Date(),
        consecutiveFailures: 0,
        requestsThisHour: 0,
        hourStartTime: new Date()
    };

    if (getTotalCount) {
        try {
            initialStats.initialTotal = await getTotalCount(isDryRun);
            log.info({ totalItems: initialStats.initialTotal }, 'Total items to process identified');
        } catch (e) {
            log.warn({ error: e }, 'Failed to get total count');
        }
    }

    const stats = initialStats;
    let shouldContinue = true;

    while (shouldContinue) {
        // ... (existing loop content)    
        // 0. Hourly Limit Check
        const now = new Date();
        const hourElapsed = now.getTime() - stats.hourStartTime.getTime();
        if (hourElapsed >= 60 * 60 * 1000) {
            stats.requestsThisHour = 0;
            stats.hourStartTime = now;
            log.info('New hour started, request counter reset');
        }

        if (stats.requestsThisHour >= config.MAX_REQUESTS_PER_HOUR) {
            const waitMs = 60 * 60 * 1000 - hourElapsed;
            log.warn({
                requestsThisHour: stats.requestsThisHour,
                limit: config.MAX_REQUESTS_PER_HOUR,
                wait: formatDuration(waitMs)
            }, 'THROTTLE: Hourly request limit reached');
            await sleep(waitMs);
            stats.requestsThisHour = 0;
            stats.hourStartTime = new Date();
            continue;
        }

        // 1. Fetch
        const items = await fetchBatch(config.BATCH_SIZE, isDryRun);
        if (items.length === 0) {
            log.info('No more items to process. Job done!');
            break;
        }

        stats.batchCount++;
        stats.requestsThisHour++;

        // In continuous mode, reduce log noise. Only show progress.
        if (!isContinuous) {
            log.info({
                batch: stats.batchCount,
                count: items.length
            }, 'Processing batch');
        }

        // 2. Process (Parallel chunks)
        const subBatchSize = Math.ceil(items.length / config.PARALLEL_REQUESTS);
        const chunks = chunkArray(items, subBatchSize);

        const results = await Promise.all(chunks.map((chunk, idx) => {
            // We pass a unique batch index for logging distinct threads if needed
            return processBatch(chunk, isDryRun, stats.batchCount * 100 + idx, context);
        }));

        // 3. Aggregate
        let aggregatedSuccess = 0;
        let circuitBreakAction: 'level1' | 'level2' | 'service_outage' | undefined;

        for (const res of results) {
            aggregatedSuccess += res.successCount;
            if (res.circuitBreak) {
                if (res.circuitBreak === 'service_outage') circuitBreakAction = 'service_outage';
                else if (res.circuitBreak === 'level2' && circuitBreakAction !== 'service_outage') circuitBreakAction = 'level2';
                else if (!circuitBreakAction) circuitBreakAction = 'level1';
            }
            // Logic for writing debug log on dry run
            if (isDryRun && res.debugInfo) {
                await writeDebugLog(jobName, res.debugInfo);
            }
        }

        const failedCount = items.length - aggregatedSuccess;
        stats.totalSuccess += aggregatedSuccess;
        stats.totalFailed += failedCount;
        stats.totalProcessed += aggregatedSuccess;

        if (failedCount > 0 && aggregatedSuccess === 0) {
            stats.consecutiveFailures++;
        } else {
            stats.consecutiveFailures = 0;
        }

        // 4. Circuit Breaker Logic
        if (circuitBreakAction === 'service_outage') {
            const waitMs = 5 * 60 * 1000;
            log.error({ wait: formatDuration(waitMs) }, 'CRITICAL: Service Outage. Sleeping...');
            if (isContinuous) {
                await sleep(waitMs);
                stats.consecutiveFailures = 0;
                continue;
            } else break;
        } else if (circuitBreakAction === 'level2') {
            const resetTime = getNextResetTime();
            const waitMs = resetTime.getTime() - Date.now();
            log.warn({ wait: formatDuration(waitMs) }, 'PAUSED: Daily Quota Exhausted');
            if (isContinuous) {
                await sleep(waitMs);
                stats.consecutiveFailures = 0;
                continue;
            } else break;
        } else if (circuitBreakAction === 'level1') {
            const cooldownMs = config.RATE_LIMIT_COOLDOWN_MS * (1 + stats.consecutiveFailures * 0.5);
            log.warn({ wait: formatDuration(cooldownMs) }, 'COOLDOWN: Rate Limit triggered');
            await sleep(cooldownMs);
        } else if (stats.consecutiveFailures >= config.MAX_CONSECUTIVE_FAILURES) {
            const longWait = config.RATE_LIMIT_COOLDOWN_MS * stats.consecutiveFailures;
            log.error({ wait: formatDuration(longWait) }, 'CIRCUIT BREAKER: Too many failures');
            await sleep(longWait);
            stats.consecutiveFailures = 0;
        }

        // 5. Progress Report
        const elapsed = Date.now() - stats.startTime.getTime();
        let progressMsg = {
            processed: stats.totalProcessed,
            success: stats.totalSuccess,
            failed: stats.totalFailed,
            elapsed: formatDuration(elapsed)
        };

        if (stats.initialTotal && stats.initialTotal > 0) {
            // Assuming totalProcessed is cumulative. 
            // NOTE: fetchBatch takes pending items, so totalProcessed isn't necessarily total done relative to initialTotal unless we assume job started from 0 or we track global status.
            // But usually ETL runs on remaining items. So processed / (processed + remaining) ? 
            // Simpler: processed / initialTotal.

            const percentage = getProgressBar(stats.totalProcessed, stats.initialTotal);
            Object.assign(progressMsg, { progress: percentage });
        }

        log.info(progressMsg, 'Progress');

        // 6. Loop Control
        if (!isContinuous) {
            shouldContinue = false;
        } else {
            if (circuitBreakAction) {
                // If we hit a circuit break, we likely already slept.
            } else {
                await sleep(config.BATCH_INTERVAL_MS);
            }
        }
    }

    // Final Summary
    const totalElapsed = Date.now() - stats.startTime.getTime();

    log.info({
        jobName,
        status: 'COMPLETE',
        totalBatches: stats.batchCount,
        totalSuccess: stats.totalSuccess,
        totalFailed: stats.totalFailed,
        duration: formatDuration(totalElapsed)
    }, 'ETL Job Complete');
}
