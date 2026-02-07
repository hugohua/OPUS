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
        concurrency: 3, // 提升并发度，加快缓存补充速度
        limiter: {
            max: 10, // 提升速率限制：每分钟最多 10 个任务
            duration: 60000,
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
log.info({
    fast: process.env.AI_FAST_ORDER || 'aliyun,openrouter',
    smart: process.env.AI_SMART_ORDER || 'openrouter,aliyun'
}, 'LLM Provider 顺序');

// 优雅关闭
process.on('SIGTERM', async () => {
    log.info('收到 SIGTERM，正在关闭 Worker...');
    await drillWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    log.info('收到 SIGINT，正在关闭 Worker...');
    await drillWorker.close();
    process.exit(0);
});
