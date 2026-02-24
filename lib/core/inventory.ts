import { redis as connection } from '@/lib/queue/connection';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { createLogger } from '@/lib/logger';
import { inventoryQueue } from '@/lib/queue';

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
        const stats: any = await this.getInventoryStats(userId);
        const currentCount = stats[mode] || 0;

        // Soft Cap: 溢出容忍，接受但打日志（竞态正常现象/突破硬上限救急现象）
        const softCap = await this.getCapacity(mode);
        if (currentCount >= softCap) {
            log.info({ userId, mode, vocabId, currentCount, softCap },
                '📦 Overflow accepted (race condition or emergency replenish)');
        }

        // 正常入库
        const key = keys.drillList(userId, mode, vocabId);
        const pipeline = connection.pipeline();
        pipeline.rpush(key, JSON.stringify(drill));
        pipeline.hincrby(keys.stats(userId), mode, 1);
        await pipeline.exec();

        log.info({ userId, mode, vocabId }, 'Drill pushed to inventory');
    },

    /**
     * 批量消费 Drill (Only for Mixed Mode)
     * 解决 N+1 查询问题，一次性获取所有场景的 Drill
     * 
     * @param userId 
     * @param scenarioGroups { "SYNTAX": [vid1, vid2], "PHRASE": [vid3] }
     */
    async popDrillBatch(userId: string, scenarioGroups: Record<string, number[]>): Promise<Record<number, BriefingPayload>> {
        const pipeline = connection.pipeline();
        const orderedRequests: { mode: string, vocabId: number }[] = [];

        // 1. 构建 Pipeline
        for (const [mode, vids] of Object.entries(scenarioGroups)) {
            for (const vid of vids) {
                const key = keys.drillList(userId, mode, vid);
                pipeline.lpop(key);
                orderedRequests.push({ mode, vocabId: vid });
            }
        }

        if (orderedRequests.length === 0) return {};

        // 2. 执行批量操作
        const results = await pipeline.exec();
        const resultMap: Record<number, BriefingPayload> = {};
        const replenishTriggers: Promise<void>[] = [];

        // 3. 处理结果
        orderedRequests.forEach((req, index) => {
            const [err, data] = results?.[index] || [null, null];

            if (!err && data) {
                // 如果成功获取数据
                resultMap[req.vocabId] = JSON.parse(data as string);

                // 异步递减统计（不阻塞主流程）
                connection.hincrby(keys.stats(userId), req.mode, -1).catch(e =>
                    log.error({ error: e, ...req }, 'Stats decrement failed')
                );
            }

            // 检查水位（无论是否 Cache Miss，都要检查，保持库存健康）
            replenishTriggers.push(
                this.checkAndTriggerReplenish(userId, req.mode, req.vocabId).catch(e =>
                    log.error({ error: e.message, ...req }, 'Batch replenish trigger failed')
                )
            );
        });

        // 异步等待所有水位检查触发（不阻塞返回）
        Promise.all(replenishTriggers).catch(e => log.error(e));

        return resultMap;
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
        // [Fix] 防止无限生成循环：如果系统处于严重饱和状态 (>= HardCap)，
        // 应当暂停对极冷门单词的无休止补货请求，避免队列无限增长。
        const isSaturated = await this.isSaturated(userId, mode);
        if (isSaturated) {
            log.warn({ userId, mode, vocabId }, '⛔ System saturated (Hard Cap reached), blocking local fetch to prevent loop');
            return;
        }

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
        const jobId = `replenish-${userId}-${mode}-${vocabId}`;

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
        const jobId = `replenish-batch-${userId}-${mode}-${timeWindow}`;

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
            BLITZ: parseInt(raw.BLITZ || '0'),
            VISUAL: parseInt(raw.VISUAL || '0'),
            CONTEXT: parseInt(raw.CONTEXT || '0'),
            ARENA_PART5: parseInt(raw.ARENA_PART5 || '0'),
            ARENA_PART6: parseInt(raw.ARENA_PART6 || '0'),
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
     * 检查库存是否已满 (基于 Soft Cap)
     * 用于控制是否触发新的 LLM 生成，不控制入库。
     * 入库由 pushDrill 的 Hard Cap 控制。
     */
    async isFull(userId: string, mode: string): Promise<boolean> {
        const stats: any = await this.getInventoryStats(userId);
        const currentCount = stats[mode] || 0;
        const capacity = await this.getCapacity(mode);
        return currentCount >= capacity;
    },

    /**
     * 检查库存是否处于极度饱和状态 (基于 Hard Cap)
     * 用于防止极端情况下，某个特定次要单词的补充请求导致无休止的任务入队
     */
    async isSaturated(userId: string, mode: string): Promise<boolean> {
        const stats: any = await this.getInventoryStats(userId);
        const currentCount = stats[mode] || 0;
        const hardCap = await this.getHardCapacity(mode);
        return currentCount >= hardCap;
    },

    /**
     * 获取 Soft Cap (正常容量上限)
     * 控制 isFull() 判断，决定是否触发新生成
     */
    async getCapacity(mode: string): Promise<number> {
        const { CACHE_LIMIT_MAP, DRILLS_PER_BATCH } = await import('@/lib/drill-cache');
        // Soft Cap = Limit (Batches) * DRILLS_PER_BATCH
        return (CACHE_LIMIT_MAP[mode as SessionMode] || 5) * DRILLS_PER_BATCH;
    },

    /**
     * 获取 Hard Cap (绝对上限 = Soft Cap × 1.5)
     * 仅在 pushDrill 中使用，防止 Redis 内存膨胀
     * 正常情况下不应触发，仅在极端竞态时生效
     */
    async getHardCapacity(mode: string): Promise<number> {
        const softCap = await this.getCapacity(mode);
        return Math.ceil(softCap * 1.5);
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
    },

    /**
     * 清空指定 Mode 的库存
     */
    async clearMode(userId: string, mode: string): Promise<number> {
        // 1. Find keys for this specific mode
        const pattern = `user:${userId}:mode:${mode}:vocab:*:drills`;
        let cursor = '0';
        const keysToDelete: string[] = [];

        do {
            const [nextCursor, foundKeys] = await connection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            keysToDelete.push(...foundKeys);
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            // Delete in batches
            const BATCH_SIZE = 100;
            for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
                const batch = keysToDelete.slice(i, i + BATCH_SIZE);
                await connection.del(...batch);
            }
        }

        // 2. Reset stats for this mode
        await connection.hset(keys.stats(userId), mode, 0);

        log.info({ userId, mode, deletedCount: keysToDelete.length }, '🗑️ Mode inventory cleared');
        return keysToDelete.length;
    }
};
