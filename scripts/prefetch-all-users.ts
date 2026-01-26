/**
 * prefetch-all-users - 批量预生成用户 Drill 缓存
 * 功能：
 *   为所有活跃用户预生成 Drill 缓存，存入 DrillCache 表
 *   支持 Vercel Cron 或手动执行
 * 使用方法：
 *   npx tsx scripts/prefetch-all-users.ts
 *   npx tsx scripts/prefetch-all-users.ts --dry-run  # 仅预览，不执行
 * 注意：
 *   1. 需要 DATABASE_URL 环境变量
 *   2. 需要 AI 配置（OPENAI_API_KEY 等）
 *   3. 建议配合 Cron 定时任务使用
 */

// 加载环境变量
try { process.loadEnvFile(); } catch { }

import { db } from '@/lib/db';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { saveDrillToCache, checkCacheStatus } from '@/lib/drill-cache';
import { createLogger } from '@/lib/logger';
import { SessionMode } from '@/types/briefing';

const log = createLogger('script:prefetch-all-users');

// --- 配置 ---
// --- 配置 ---
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
const CACHE_THRESHOLD = 2; // 每个模式至少保持 2 条缓存
const ACTIVE_DAYS = 7;     // 最近 N 天活跃的用户

interface PrefetchResult {
    userId: string;
    mode: SessionMode;
    status: 'success' | 'skipped' | 'error';
    message?: string;
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    log.info({ isDryRun }, '开始批量预生成 Drill 缓存');

    // 1. 获取活跃用户列表
    const activeUsers = await getActiveUsers();
    log.info({ count: activeUsers.length }, `找到 ${activeUsers.length} 个活跃用户`);

    if (activeUsers.length === 0) {
        log.info('没有活跃用户，退出');
        return;
    }

    const results: PrefetchResult[] = [];

    // 2. 为每个用户的每个模式检查并补充缓存
    for (const user of activeUsers) {
        for (const mode of MODES) {
            try {
                // 检查缓存状态
                const needsRefill = await checkCacheStatus(user.id, mode, CACHE_THRESHOLD);

                if (!needsRefill) {
                    results.push({
                        userId: user.id,
                        mode,
                        status: 'skipped',
                        message: '缓存充足'
                    });
                    continue;
                }

                if (isDryRun) {
                    log.info({ userId: user.id, mode }, '[DRY-RUN] 需要补充缓存');
                    results.push({
                        userId: user.id,
                        mode,
                        status: 'skipped',
                        message: 'Dry run - 跳过实际生成'
                    });
                    continue;
                }

                // 生成新缓存
                log.info({ userId: user.id, mode }, '开始生成缓存...');

                const result = await getNextDrillBatch({
                    userId: user.id,
                    mode,
                    limit: BATCH_SIZE_MAP[mode],
                    forceRefresh: true, // 强制生成，不读取现有缓存
                });

                if (result.status === 'success' && result.data) {
                    // 保存到缓存
                    await saveDrillToCache(user.id, mode, result.data);

                    results.push({
                        userId: user.id,
                        mode,
                        status: 'success',
                        message: `生成 ${result.data.length} 条`
                    });

                    log.info({ userId: user.id, mode, count: result.data.length }, '缓存生成成功');
                } else {
                    results.push({
                        userId: user.id,
                        mode,
                        status: 'error',
                        message: result.message
                    });

                    log.error({ userId: user.id, mode, message: result.message }, '缓存生成失败');
                }

                // 限速：避免 AI API 过载
                await sleep(1000);

            } catch (error: any) {
                results.push({
                    userId: user.id,
                    mode,
                    status: 'error',
                    message: error.message
                });

                log.error({ userId: user.id, mode, error: error.message }, '处理异常');
            }
        }
    }

    // 3. 输出统计
    const stats = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        error: results.filter(r => r.status === 'error').length,
    };

    log.info(stats, '预生成任务完成');

    // 输出错误详情
    const errors = results.filter(r => r.status === 'error');
    if (errors.length > 0) {
        log.warn({ errors }, '以下任务失败');
    }

    console.log('\n=== 预生成统计 ===');
    console.log(`总计: ${stats.total}`);
    console.log(`成功: ${stats.success}`);
    console.log(`跳过: ${stats.skipped}`);
    console.log(`失败: ${stats.error}`);
}

/**
 * 获取活跃用户列表
 * 活跃定义：最近 N 天有学习记录
 */
async function getActiveUsers() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ACTIVE_DAYS);

    // 查找最近有 UserProgress 更新的用户
    const activeUserIds = await db.userProgress.findMany({
        where: {
            last_review_at: { gte: cutoffDate }
        },
        select: { userId: true },
        distinct: ['userId']
    });

    // 如果没有活跃记录，返回所有用户（兜底）
    if (activeUserIds.length === 0) {
        return db.user.findMany({
            select: { id: true },
            take: 100 // 限制数量
        });
    }

    return activeUserIds.map(u => ({ id: u.userId }));
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行
main()
    .catch(e => {
        log.error({ error: e }, '脚本执行失败');
        process.exit(1);
    })
    .finally(() => {
        db.$disconnect();
    });
