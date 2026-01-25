/**
 * Opus Worker 入口
 * 功能：
 *   后台处理 AI 内容生成任务
 * 使用方法：
 *   npx tsx workers/index.ts
 *   或 npx tsx --watch workers/index.ts (开发模式)
 * 部署：
 *   Docker 容器运行此脚本
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/queue/connection';
import { DrillJobData } from '@/lib/queue/inventory-queue';
import { processDrillJob } from './drill-processor';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'worker' });

// Worker 实例
const drillWorker = new Worker<DrillJobData>(
    'drill-inventory',
    async (job: Job<DrillJobData>) => {
        return processDrillJob(job);
    },
    {
        connection: redis,
        concurrency: 1, // 单并发，避免 LLM 速率限制
        limiter: {
            max: 2,
            duration: 60000, // 每分钟最多 2 个任务
        },
    }
);

// 事件监听
drillWorker.on('completed', (job, result) => {
    log.info(
        {
            jobId: job.id,
            mode: job.data.mode,
            userId: job.data.userId,
            result,
        },
        '✅ Job 完成'
    );
});

drillWorker.on('failed', (job, err) => {
    log.error(
        {
            jobId: job?.id,
            mode: job?.data.mode,
            error: err.message,
            stack: err.stack,
        },
        '❌ Job 失败'
    );
});

drillWorker.on('error', (err) => {
    log.error({ error: err.message }, 'Worker 错误');
});

drillWorker.on('stalled', (jobId) => {
    log.warn({ jobId }, '⚠️ Job Stalled');
});

// 启动日志
log.info('🚀 Opus Drill Worker 已启动');
log.info({ redis: process.env.REDIS_URL }, 'Redis 连接');
log.info({ providers: process.env.AI_PROVIDER_ORDER || 'aliyun,openrouter' }, 'LLM Provider 顺序');

// 优雅关闭
process.on('SIGTERM', async () => {
    log.info('收到 SIGTERM，正在关闭 Worker...');
    await drillWorker.close();
    await settlerWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    log.info('收到 SIGINT，正在关闭 Worker...');
    await drillWorker.close();
    await settlerWorker.close();
    process.exit(0);
});

// ============================================
// [V2.0 New] Session Settler Worker (CRON)
// ============================================
import { Queue } from 'bullmq';
import { processSettlerJob } from './session-settler';

// 创建 Queue (用于 Repeat Jobs)
const settlerQueue = new Queue('session-settler', { connection: redis });

// 添加 Repeatable Job (每分钟)
(async () => {
    // 先清理旧的 Repeat Job
    const repeatableJobs = await settlerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await settlerQueue.removeRepeatableByKey(job.key);
    }

    // 添加新的 Repeat Job
    await settlerQueue.add(
        'settle',
        {},
        {
            repeat: {
                pattern: '* * * * *' // 每分钟
            }
        }
    );
    log.info('📅 Session Settler CRON 已配置 (每分钟)');
})();

// Worker 实例
const settlerWorker = new Worker(
    'session-settler',
    async () => {
        return processSettlerJob();
    },
    {
        connection: redis,
        concurrency: 1,
    }
);

settlerWorker.on('completed', (job, result) => {
    log.info({ jobId: job.id, result }, '✅ Settler Job 完成');
});

settlerWorker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, error: err.message }, '❌ Settler Job 失败');
});

log.info('🚀 Session Settler Worker 已启动');

