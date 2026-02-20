/**
 * Cron - 预生成 Drill 缓存
 * 功能：
 *   Vercel Cron 触发的 API Route
 *   为所有活跃用户预生成 Drill 缓存
 * 配置：
 *   见 vercel.json 中的 crons 配置
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory } from '@/lib/core/inventory'; // [Fix] Use inventory stats directly
import { enqueueDrillGeneration } from '@/lib/queue/inventory-queue'; // [Fix] Enqueue instead of consume
import { createLogger } from '@/lib/logger';
import { SessionMode } from '@/types/briefing';

const log = createLogger('api:cron:prefetch');

// 验证 Cron 密钥（防止外部调用）
// 验证 Cron 密钥（防止外部调用）
const CRON_SECRET = process.env.CRON_SECRET;

// 配置
const MODES: SessionMode[] = ['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ', 'AUDIO', 'PHRASE', 'CONTEXT'];
// [Fix] Import shared limits from drill-cache
import { CACHE_LIMIT_MAP } from '@/lib/drill-cache';

const ACTIVE_DAYS = 7;

export async function GET(request: NextRequest) {
    // 验证 Cron 密钥
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        log.warn('未授权的 Cron 调用');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Cron 任务开始: 检查并补充库存 (Producer Mode)');

    try {
        // 1. 获取活跃用户
        const activeUsers = await getActiveUsers();
        log.info({ count: activeUsers.length }, `找到 ${activeUsers.length} 个活跃用户`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // 2. 为每个用户检查库存
        for (const user of activeUsers) {

            // 批量获取该用户的所有库存统计 (O(1))
            let stats;
            try {
                stats = await inventory.getInventoryStats(user.id);
            } catch (e) {
                log.error({ userId: user.id, error: String(e) }, '无法读取库存统计');
                errorCount += MODES.length;
                continue;
            }

            for (const mode of MODES) {
                try {
                    // 读取 Redis 缓存的实时水位
                    // stats key e.g. "SYNTAX", "BLITZ"
                    const currentLevel = stats[mode as keyof typeof stats] || 0;

                    // [Fix] Use shared CACHE_LIMIT_MAP via inventory.getCapacity
                    // CACHE_LIMIT_MAP is in Batches (1 Batch = 10 Drills)
                    const maxDrills = await inventory.getCapacity(mode);

                    // Logic: Replenish when < 50% of capacity
                    const threshold = Math.floor(maxDrills * 0.5);

                    if (currentLevel < threshold) {
                        // 水位低 -> 触发补货 (Producer Only)
                        // 使用 'cron' 优先级，避免阻塞实时请求
                        await enqueueDrillGeneration(user.id, mode, 'cron');

                        log.info({ userId: user.id, mode, currentLevel, threshold }, '📉 水位低，已触发补货任务');
                        successCount++;
                    } else {
                        // 水位足 -> 跳过
                        skipCount++;
                    }

                    // 简单的限速，避免瞬间打爆 Redis/Queue
                    await sleep(50);

                } catch (error: any) {
                    errorCount++;
                    log.error({ userId: user.id, mode, error: error.message }, '处理异常');
                }
            }
        }

        const resultStats = { successCount, skipCount, errorCount };
        log.info(resultStats, 'Cron 任务完成');

        return NextResponse.json({
            status: 'success',
            message: 'Inventory check complete',
            stats: resultStats
        });

    } catch (error: any) {
        log.error({ error: error.message }, 'Cron 任务失败');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function getActiveUsers() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ACTIVE_DAYS);

    const activeUserIds = await db.userProgress.findMany({
        where: {
            last_review_at: { gte: cutoffDate }
        },
        select: { userId: true },
        distinct: ['userId']
    });

    if (activeUserIds.length === 0) {
        return db.user.findMany({
            select: { id: true },
            take: 100
        });
    }

    return activeUserIds.map(u => ({ id: u.userId }));
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
