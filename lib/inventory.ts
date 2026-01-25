import { redis as connection } from '@/lib/queue/connection';
import { BriefingPayload, SessionMode, DrillType } from '@/types/briefing';
import { createLogger } from '@/lib/logger';
import { inventoryQueue } from '@/lib/queue';

const log = createLogger('lib:inventory');

// Redis Key Generator
const keys = {
    /**
     * @deprecated 旧版 key (按 mode 分组)，后续删除
     */
    drillList: (userId: string, mode: string, vocabId: number | string) =>
        `user:${userId}:mode:${mode}:vocab:${vocabId}:drills`,

    /**
     * [V2.0 New] 按题型分频道存储
     * inventory:{userId}:vocab:{vocabId}:{drillType}
     */
    drillTypeList: (userId: string, vocabId: number | string, drillType: DrillType) =>
        `inventory:${userId}:vocab:${vocabId}:${drillType}`,

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

        if (len < 2) {
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
        await inventoryQueue.add('replenish_one', {
            userId,
            mode: mode as SessionMode,
            vocabId: Number(vocabId),
            correlationId: `emergency-${vocabId}-${Date.now()}`
        }, {
            priority: 1 // High Priority
        });
        log.info({ userId, mode, vocabId }, '🚑 Emergency replenishment triggered');
    },

    /**
     * 触发批量急救任务 (Plan B in Batch)
     * 用于冷启动时，一次性补充多个缺货单词，避免发送多个单独的急救包
     */
    async triggerBatchEmergency(userId: string, mode: string, vocabIds: number[]) {
        if (vocabIds.length === 0) return;

        await inventoryQueue.add('replenish_batch', {
            userId,
            mode: mode as SessionMode,
            vocabIds,
            correlationId: `batch-emergency-${Date.now()}`
        }, {
            priority: 1 // High Priority (Same as Emergency)
        });
        log.info({ userId, mode, count: vocabIds.length }, '🚑📦 Batch Emergency replenishment triggered');
    },

    /**
     * 获取库存统计
     */
    async getInventoryStats(userId: string) {
        const raw = await connection.hgetall(keys.stats(userId));

        // Convert string values to numbers
        return {
            SYNTAX: parseInt(raw.SYNTAX || '0'),
            CHUNKING: parseInt(raw.CHUNKING || '0'),
            NUANCE: parseInt(raw.NUANCE || '0'),
            BLITZ: parseInt(raw.BLITZ || '0'),
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

    // ============================================
    // [V2.0 New] 分频道题型库存 API
    // ============================================

    /**
     * [V2.0] 推入指定题型的 Drill
     */
    async pushDrillV2(userId: string, vocabId: number, drillType: DrillType, drill: BriefingPayload) {
        const key = keys.drillTypeList(userId, vocabId, drillType);
        await connection.rpush(key, JSON.stringify(drill));
        log.info({ userId, vocabId, drillType }, '[V2] Drill pushed to inventory');
    },

    /**
     * [V2.0] 消费指定题型的 Drill
     */
    async popDrillV2(userId: string, vocabId: number, drillType: DrillType): Promise<BriefingPayload | null> {
        const key = keys.drillTypeList(userId, vocabId, drillType);
        const data = await connection.lpop(key);
        if (!data) return null;
        return JSON.parse(data);
    },

    /**
     * [V2.0] 获取单词所有题型的库存数量
     */
    async getInventoryCountsByType(userId: string, vocabId: number): Promise<Record<DrillType, number>> {
        const drillTypes: DrillType[] = ['S_V_O', 'VISUAL_TRAP', 'PART5_CLOZE'];
        const pipeline = connection.pipeline();

        drillTypes.forEach((dt) => {
            pipeline.llen(keys.drillTypeList(userId, vocabId, dt));
        });

        const results = await pipeline.exec();
        const counts: Partial<Record<DrillType, number>> = {};

        drillTypes.forEach((dt, index) => {
            const result = results?.[index];
            counts[dt] = result && result[0] === null ? (result[1] as number) : 0;
        });

        return counts as Record<DrillType, number>;
    },

    /**
     * [V2.0] 批量获取多个单词的指定题型库存
     */
    async getInventoryCountsByTypeV2(
        userId: string,
        vocabIds: number[],
        drillType: DrillType
    ): Promise<Record<number, number>> {
        if (vocabIds.length === 0) return {};

        const pipeline = connection.pipeline();
        vocabIds.forEach((vid) => {
            pipeline.llen(keys.drillTypeList(userId, vid, drillType));
        });

        const results = await pipeline.exec();
        const counts: Record<number, number> = {};

        vocabIds.forEach((vid, index) => {
            const result = results?.[index];
            counts[vid] = result && result[0] === null ? (result[1] as number) : 0;
        });

        return counts;
    }
};
