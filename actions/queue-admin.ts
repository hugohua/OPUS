/**
 * 队列管理 Server Actions
 * 功能：
 *   队列状态查询、暂停/恢复、清空、手动触发
 * 用途：
 *   供队列管理 Dashboard 页面使用
 */
'use server';

import { db } from '@/lib/db';
import {
    getQueueCounts,
    isQueuePaused,
    pauseQueue,
    resumeQueue,
    clearQueue,
    enqueueDrillGeneration
} from '@/lib/queue';
import { SessionMode } from '@/types/briefing';
import { ActionState } from '@/types/action';
import { auditInventoryEvent } from '@/lib/services/audit-service';
import { revalidatePath } from 'next/cache';
import { getCacheCount, CACHE_LIMIT_MAP } from '@/lib/drill-cache';

// --- 查询类 ---

/**
 * 获取队列状态
 */
export async function getQueueStatus() {
    try {
        const [counts, isPaused] = await Promise.all([
            getQueueCounts(),
            isQueuePaused(),
        ]);

        return {
            ...counts,
            isPaused,
        };
    } catch (error) {
        console.error('getQueueStatus error:', error);
        return {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            isPaused: false,
        };
    }
}

/**
 * 获取缓存统计
 */
export async function getCacheStats(): Promise<{
    SYNTAX: number;
    PHRASE: number;
    CHUNKING: number;
    AUDIO: number;
    NUANCE: number;
    READING: number;
    total: number;
    targets: {
        SYNTAX: number;
        PHRASE: number;
        CHUNKING: number;
        AUDIO: number;
        NUANCE: number;
        READING: number;
    };
}> {
    try {
        const session = await import('@/auth').then(m => m.auth());
        if (!session?.user?.id) return {
            SYNTAX: 0, PHRASE: 0, CHUNKING: 0, AUDIO: 0, NUANCE: 0, READING: 0, total: 0,
            targets: { SYNTAX: 50, PHRASE: 50, CHUNKING: 50, AUDIO: 50, NUANCE: 30, READING: 50 }
        };

        const { inventory } = await import('@/lib/core/inventory');
        const stats = await inventory.getInventoryStats(session.user.id);

        // Convert batch limits to drill targets (1 Batch = DRILLS_PER_BATCH Drills)
        const { DRILLS_PER_BATCH } = await import('@/lib/drill-cache');
        const targets = Object.keys(CACHE_LIMIT_MAP).reduce((acc, key) => {
            const mode = key as SessionMode;
            acc[mode] = (CACHE_LIMIT_MAP[mode] || 5) * DRILLS_PER_BATCH;
            return acc;
        }, {} as Record<SessionMode, number>);

        return { ...stats, targets };
    } catch (error) {
        console.error('getCacheStats error:', error);
        return {
            SYNTAX: 0, PHRASE: 0, CHUNKING: 0, AUDIO: 0, NUANCE: 0, READING: 0, total: 0,
            targets: { SYNTAX: 50, PHRASE: 50, CHUNKING: 50, AUDIO: 50, NUANCE: 30, READING: 50 }
        };
    }
}

// --- 操作类 ---

/**
 * 暂停队列
 */
export async function handlePauseQueue(): Promise<ActionState> {
    try {
        await pauseQueue();
        revalidatePath('/admin/queue');
        return { status: 'success', message: '队列已暂停' };
    } catch (error) {
        return { status: 'error', message: (error as Error).message };
    }
}

/**
 * 恢复队列
 */
export async function handleResumeQueue(): Promise<ActionState> {
    try {
        await resumeQueue();
        revalidatePath('/admin/queue');
        return { status: 'success', message: '队列已恢复' };
    } catch (error) {
        return { status: 'error', message: (error as Error).message };
    }
}

/**
 * 清空队列
 */
export async function handleClearQueue(): Promise<ActionState> {
    try {
        await clearQueue();
        revalidatePath('/admin/queue');
        return { status: 'success', message: '队列已清空' };
    } catch (error) {
        return { status: 'error', message: (error as Error).message };
    }
}

// ... (省略中间代码)

/**
 * 手动触发生成
 * [Fix] 使用 Redis 库存检查替代 Postgres
 */
export async function handleTriggerGeneration(
    userId: string,
    mode: SessionMode
): Promise<ActionState> {
    try {
        // 0. Pre-check: 检查 Redis 库存是否充足
        const { inventory } = await import('@/lib/core/inventory');

        if (await inventory.isFull(userId, mode)) {
            // Fetch stats only for message
            const stats = await inventory.getInventoryStats(userId) as Record<string, number>;
            const currentCount = stats[mode] || 0;
            const capacity = await inventory.getCapacity(mode);

            return {
                status: 'success',
                message: `库存充足 (${currentCount}题 >= ${capacity}题阈值), 无需生成`
            };
        }

        // For message context if proceed
        const stats = await inventory.getInventoryStats(userId) as Record<string, number>;
        const currentCount = stats[mode] || 0;

        const jobs = await enqueueDrillGeneration(userId, mode, 'realtime');
        revalidatePath('/admin/queue');

        // [Audit] 记录手动触发事件
        auditInventoryEvent(userId, 'TRIGGER', mode, {
            currentCount,
            capacity: await inventory.getCapacity(mode),
            source: 'manual'
        });

        return {
            status: 'success',
            message: `${jobs.length} 个任务已入队 (当前库存: ${currentCount}题)`,
            data: { jobIds: jobs.map(j => j.id) }
        };
    } catch (error) {
        return { status: 'error', message: (error as Error).message };
    }
}
