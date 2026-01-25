/**
 * DrillBatch 库存队列
 * 功能：
 *   定义 AI 内容生成任务队列，支持多优先级
 * 队列类型：
 *   - realtime: 用户即将消费的下一批（高优先级）
 *   - cron: 定时补货（低优先级）
 */
import { Queue } from 'bullmq';
import { redis } from './connection';
import { SessionMode } from '@/types/briefing';

// Job 数据结构
export interface DrillJobData {
    userId: string;
    mode: SessionMode;
    priority?: 'realtime' | 'cron';
    correlationId: string;
    // Plan B: Single Vocab Replenishment
    vocabId?: number;
    // Plan C: Batch Vocab Replenishment
    vocabIds?: number[];
    // Plan A: Generic Fetch Force Limit
    forceLimit?: number;
}

// 队列实例
export const inventoryQueue = new Queue<DrillJobData>('drill-inventory', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,  // 保留最近 100 个完成任务
        removeOnFail: 500,       // 保留最近 500 个失败任务
    },
});

/**
 * 入队 Drill 生成任务
 * @param userId 用户 ID
 * @param mode Session 模式
 * @param priority 优先级（realtime 高，cron 低）
 */
export async function enqueueDrillGeneration(
    userId: string,
    mode: SessionMode,
    priority: 'realtime' | 'cron' = 'realtime'
) {
    // realtime = 1 (最高), cron = 5 (较低)
    const priorityValue = priority === 'realtime' ? 1 : 5;

    // 根据模式决定需要拆分成多少个批次 (每个批次 10 条)
    const MODE_TARGET_COUNT: Record<SessionMode, number> = {
        SYNTAX: 20,     // 20/10 = 2 batches
        CHUNKING: 30,   // 30/10 = 3 batches
        NUANCE: 50,     // 50/10 = 5 batches
        BLITZ: 10       // 10/10 = 1 batch
    };

    const targetCount = MODE_TARGET_COUNT[mode] || 20;
    const batches = Math.ceil(targetCount / 10);

    // 批量入队 (Pipeline)
    const jobs = [];
    for (let i = 0; i < batches; i++) {
        jobs.push(
            inventoryQueue.add(
                `generate-${mode}`,
                {
                    userId,
                    mode,
                    priority,
                    correlationId: `${userId}-${mode}-${i}-${Date.now()}`
                },
                { priority: priorityValue }
            )
        );
    }

    return Promise.all(jobs);
}

// 导出队列管理方法（供管理页面使用）
export async function getQueueCounts() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        inventoryQueue.getWaitingCount(),
        inventoryQueue.getActiveCount(),
        inventoryQueue.getCompletedCount(),
        inventoryQueue.getFailedCount(),
        inventoryQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
}

export async function isQueuePaused() {
    return inventoryQueue.isPaused();
}

export async function pauseQueue() {
    await inventoryQueue.pause();
}

export async function resumeQueue() {
    await inventoryQueue.resume();
}

export async function clearQueue() {
    await inventoryQueue.obliterate({ force: true });
}
