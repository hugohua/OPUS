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
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { saveDrillToCache, checkCacheStatus } from '@/lib/drill-cache';
import { createLogger } from '@/lib/logger';
import { SessionMode } from '@/types/briefing';

const log = createLogger('api:cron:prefetch');

// 验证 Cron 密钥（防止外部调用）
const CRON_SECRET = process.env.CRON_SECRET;

// 配置
const MODES: SessionMode[] = ['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ'];
const BATCH_SIZE_MAP: Record<SessionMode, number> = {
    SYNTAX: 20,
    CHUNKING: 30,
    NUANCE: 50,
    BLITZ: 10,
    PHRASE: 20,
    AUDIO: 20,
    READING: 20,
    VISUAL: 20,
};
const CACHE_THRESHOLD = 2;
const ACTIVE_DAYS = 7;

export async function GET(request: NextRequest) {
    // 验证 Cron 密钥
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        log.warn('未授权的 Cron 调用');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log.info('Cron 任务开始: 预生成 Drill 缓存');

    try {
        // 1. 获取活跃用户
        const activeUsers = await getActiveUsers();
        log.info({ count: activeUsers.length }, `找到 ${activeUsers.length} 个活跃用户`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // 2. 为每个用户补充缓存
        for (const user of activeUsers) {
            for (const mode of MODES) {
                try {
                    const needsRefill = await checkCacheStatus(user.id, mode, CACHE_THRESHOLD);

                    if (!needsRefill) {
                        skipCount++;
                        continue;
                    }

                    const result = await getNextDrillBatch({
                        userId: user.id,
                        mode,
                        limit: BATCH_SIZE_MAP[mode],
                        forceRefresh: true,
                    });

                    if (result.status === 'success' && result.data) {
                        await saveDrillToCache(user.id, mode, result.data);
                        successCount++;
                        log.info({ userId: user.id, mode }, '缓存生成成功');
                    } else {
                        errorCount++;
                        log.error({ userId: user.id, mode, message: result.message }, '生成失败');
                    }

                    // 限速
                    await sleep(500);

                } catch (error: any) {
                    errorCount++;
                    log.error({ userId: user.id, mode, error: error.message }, '处理异常');
                }
            }
        }

        const stats = { successCount, skipCount, errorCount };
        log.info(stats, 'Cron 任务完成');

        return NextResponse.json({
            status: 'success',
            message: 'Prefetch complete',
            stats
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
