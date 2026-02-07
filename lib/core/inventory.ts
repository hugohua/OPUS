import { redis as connection } from '@/lib/queue/connection';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { createLogger } from '@/lib/logger';
import { inventoryQueue } from '@/lib/queue';
import { auditInventoryEvent } from '@/lib/services/audit-service';

const log = createLogger('lib:inventory');

// Redis Key Generator
const keys = {
    // Redis Key 必须保持 Mode 粒度，因为不同 Mode 生成的内容结构不同
    // e.g., SYNTAX vs BLITZ vs AUDIO
    drillList: (userId: string, mode: string, vocabId: number | string) =>
        `user:${userId}:mode:${mode}:vocab:${vocabId}:drills`,
    replenishBuffer: 'buffer:replenish_drills',
    stats: (userId: string) => `user:${userId}:inventory:stats`,
};

/**
 * 核心库存模块 (Schedule-Driven)
 * 负责管理单词颗粒度的弹药库
 */
export const inventory = {
    /**
     * 将生成的 Drill 推入库存
     */
    async pushDrill(userId: string, mode: string, vocabId: number | string, drill: BriefingPayload) {
        // [Fix] Capacity Guard - Prevent Overflow
        const stats: any = await this.getInventoryStats(userId);
        const currentCount = stats[mode] || 0;
        const capacity = await this.getCapacity(mode);

        if (currentCount >= capacity) {
            log.warn({ userId, mode, vocabId, currentCount, capacity }, '⛔ pushDrill blocked - inventory full');
            auditInventoryEvent(userId, 'ADD', mode, { currentCount, capacity, source: 'auto' });
            return; // Early exit
        }

        const key = keys.drillList(userId, mode, vocabId);

        // Multi-exec for atomicity
        const pipeline = connection.pipeline();
        pipeline.rpush(key, JSON.stringify(drill));
        pipeline.hincrby(keys.stats(userId), mode, 1);
        await pipeline.exec();

        log.info({ userId, mode, vocabId }, 'Drill pushed to inventory');
    },

    /**
     * 消费一个 Drill (原子操作)
     * Side Effect: 如果库存水位低 (<2)，触发后台补充
     */
    async popDrill(userId: string, mode: string, vocabId: number | string): Promise<BriefingPayload | null> {
        const key = keys.drillList(userId, mode, vocabId);

        // 1. Pop content
        const results = await connection.multi()
            .lpop(key)
            .exec();

        const data = results?.[0]?.[1] as string | null;

        // If we popped something, decrement stats
        if (data) {
            await connection.hincrby(keys.stats(userId), mode, -1);
        }

        // 2. Check remaining length (Async check)
        this.checkAndTriggerReplenish(userId, mode, vocabId).catch(err => {
            log.error({ error: err.message, userId, mode, vocabId }, 'Failed to trigger replenish');
        });

        if (!data) return null;
        return JSON.parse(data);
    },

    /**
     * 检查库存水位并触发补充
     */
    async checkAndTriggerReplenish(userId: string, mode: string, vocabId: number | string) {
        const key = keys.drillList(userId, mode, vocabId);
        const len = await connection.llen(key);

        // [P1] LOW_WATERMARK = 3 (原为 2)
        if (len < 3) {
            log.info({ userId, mode, vocabId, len }, '📉 Low inventory detected. Buffering for replenishment.');
            // Add to buffer for Batch Aggregation (Plan C)
            await this.addToBuffer(userId, mode, vocabId);

            // Trigger check immediately
            await this.checkBufferAndFlush();
        }
    },

    /**
     * 将 缺货ID 加入缓冲区
     * Format: "userId:mode:vocabId"
     */
    async addToBuffer(userId: string, mode: string, vocabId: number | string) {
        const item = `${userId}:${mode}:${vocabId}`;
        await connection.sadd(keys.replenishBuffer, item);
    },

    /**
     * 检查缓冲区并 Flush (如满足阈值)
     */
    async checkBufferAndFlush() {
        const count = await connection.scard(keys.replenishBuffer);

        // Threshold = 5
        if (count >= 5) {
            await this.flushBuffer();
        }
    },

    /**
     * 强制 Flush 缓冲区 (生成 Batch Job)
     */
    async flushBuffer() {
        // Pop 10 items to process
        const items = await connection.spop(keys.replenishBuffer, 10);
        if (items.length === 0) return;

        // Group by User + Mode
        const groupedJobs: Record<string, number[]> = {};

        for (const item of items) {
            const parts = item.split(':');
            // item is uid:mode:vid. But mode might contain chars?
            // Safer parsing: 
            // format: userId:mode:vocabId. 
            // userId is cuid (string), mode is enum, vocabId is int.

            if (parts.length < 3) continue;

            const vocabId = parseInt(parts.pop()!);
            const mode = parts.pop()!;
            const userId = parts.join(':'); // remaining part is userId

            const jobKey = `${userId}:${mode}`;

            if (!groupedJobs[jobKey]) groupedJobs[jobKey] = [];
            groupedJobs[jobKey].push(vocabId);
        }

        // Enqueue Batch Jobs (Plan C)
        for (const [key, vids] of Object.entries(groupedJobs)) {
            const [uid, mode] = key.split(':');

            await inventoryQueue.add('replenish_batch', {
                userId: uid,
                mode: mode as SessionMode,
                vocabIds: vids,
                correlationId: `batch-replenish-${Date.now()}`
            }, {
                priority: 5 // Low priority for Plan C
            });

            log.info({ userId: uid, mode, count: vids.length }, '📦 Batch replenishment job enqueued');
        }
    },

    /**
     * 触发急救任务 (Plan B)
     */
    async triggerEmergency(userId: string, mode: string, vocabId: number | string) {
        // [P1] Job Deduplication: 使用确定性 Job ID 防止重复入队
        const jobId = `replenish:${userId}:${mode}:${vocabId}`;

        await inventoryQueue.add('replenish_one', {
            userId,
            mode: mode as SessionMode,
            vocabId: Number(vocabId),
            correlationId: `emergency-${vocabId}-${Date.now()}`
        }, {
            jobId, // BullMQ 会忽略重复 jobId
            priority: 1 // High Priority
        });
        log.info({ userId, mode, vocabId, jobId }, '🚑 Emergency replenishment triggered');
    },

    /**
     * 触发批量急救任务 (Plan B in Batch)
     * 用于冷启动时，一次性补充多个缺货单词，避免发送多个单独的急救包
     */
    async triggerBatchEmergency(userId: string, mode: string, vocabIds: number[]) {
        if (vocabIds.length === 0) return;

        // [P1] Job Deduplication: 使用时间窗口（分钟级）防止短时间内重复提交
        const timeWindow = Math.floor(Date.now() / 60000); // 1分钟窗口
        const jobId = `replenish-batch:${userId}:${mode}:${timeWindow}`;

        await inventoryQueue.add('replenish_batch', {
            userId,
            mode: mode as SessionMode,
            vocabIds,
            correlationId: `batch-emergency-${Date.now()}`
        }, {
            jobId, // BullMQ 会忽略重复 jobId
            priority: 1 // High Priority (Same as Emergency)
        });
        log.info({ userId, mode, count: vocabIds.length, jobId }, '🚑📦 Batch Emergency replenishment triggered');
    },

    /**
     * 获取库存统计
     */
    async getInventoryStats(userId: string) {
        const raw = await connection.hgetall(keys.stats(userId));

        // Convert string values to numbers
        return {
            SYNTAX: parseInt(raw.SYNTAX || '0'),
            PHRASE: parseInt(raw.PHRASE || '0'),
            CHUNKING: parseInt(raw.CHUNKING || '0'),
            AUDIO: parseInt(raw.AUDIO || '0'),
            NUANCE: parseInt(raw.NUANCE || '0'),
            READING: parseInt(raw.READING || '0'),
            total: Object.values(raw).reduce((a: number, b: string) => a + (parseInt(b) || 0), 0)
        };
    },
    /**
     * getInventoryCounts
     * 批量获取指定单词的库存数量
     */
    async getInventoryCounts(userId: string, mode: string, vocabIds: number[]): Promise<Record<number, number>> {
        if (vocabIds.length === 0) return {};

        const pipeline = connection.pipeline();
        vocabIds.forEach((vid) => {
            pipeline.llen(keys.drillList(userId, mode, vid));
        });

        const results = await pipeline.exec();
        const counts: Record<number, number> = {};

        vocabIds.forEach((vid, index) => {
            const result = results?.[index];
            // result is [error, result]
            const count = result && result[0] === null ? (result[1] as number) : 0;
            counts[vid] = count;
        });

        return counts;
    },

    /**
     * 检查库存是否已满 (Single Source of Truth)
     * @param userId
     * @param mode
     */
    async isFull(userId: string, mode: string): Promise<boolean> {
        const stats: any = await this.getInventoryStats(userId);
        const currentCount = stats[mode] || 0;
        const capacity = await this.getCapacity(mode);
        return currentCount >= capacity;
    },

    /**
     * 获取最大容量 (Drills)
     */
    async getCapacity(mode: string): Promise<number> {
        const { CACHE_LIMIT_MAP, DRILLS_PER_BATCH } = await import('@/lib/drill-cache');
        // Max Limit = Limit (Batches) * DRILLS_PER_BATCH 
        return (CACHE_LIMIT_MAP[mode as SessionMode] || 5) * DRILLS_PER_BATCH;
    },

    /**
     * 清空指定用户的所有库存
     * @param userId 用户 ID
     * @returns 删除的 Key 数量
     */
    async clearAll(userId: string): Promise<number> {
        // 1. Find all inventory keys for this user
        const pattern = `user:${userId}:mode:*:vocab:*:drills`;
        let cursor = '0';
        const keysToDelete: string[] = [];

        do {
            // ✅ 重命名为 foundKeys 避免与顶层 keys 对象冲突
            const [nextCursor, foundKeys] = await connection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            keysToDelete.push(...foundKeys);
        } while (cursor !== '0');

        // 2. Also include stats key (使用顶层 keys 对象)
        keysToDelete.push(keys.stats(userId));

        if (keysToDelete.length === 0) {
            log.info({ userId }, 'No inventory keys to delete');
            return 0;
        }

        // 3. Delete in batches to avoid Redis command limits
        let deletedCount = 0;
        const BATCH_SIZE = 100;

        for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
            const batch = keysToDelete.slice(i, i + BATCH_SIZE);
            deletedCount += await connection.del(...batch);
        }

        log.info({ userId, deletedCount, keyCount: keysToDelete.length }, '🗑️ Inventory cleared');

        return deletedCount;
    }
};
