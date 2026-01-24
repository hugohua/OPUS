/**
 * check-cache-status.ts
 * 功能：检查 DrillCache 表的状态，排查缓存未命中问题
 */
try { process.loadEnvFile(); } catch { }

import { db } from '@/lib/db';

async function main() {
    console.log('正在检查 DrillCache 状态...');

    // 1. 检查总记录数
    const totalCount = await db.drillCache.count();
    console.log(`\nDrillCache 总记录数: ${totalCount}`);

    // 2. 检查未消费的有效缓存
    const activeCache = await db.drillCache.findMany({
        where: {
            isConsumed: false,
            expiresAt: { gt: new Date() } // 未过期
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            userId: true,
            mode: true,
            createdAt: true,
            expiresAt: true
        }
    });

    console.log(`\n未消费且未过期的缓存: ${activeCache.length} 条`);

    if (activeCache.length > 0) {
        console.table(activeCache.map(c => ({
            id: c.id.substring(0, 8) + '...',
            userId: c.userId.substring(0, 8) + '...',
            mode: c.mode,
            createdAt: c.createdAt.toLocaleString(),
            expiresIn: Math.round((c.expiresAt.getTime() - Date.now()) / 1000 / 3600 * 10) / 10 + 'h'
        })));
    } else {
        console.log('⚠️ 当前没有可用的有效缓存！这解释了为什么页面加载慢。');
    }

    // 3. 检查已消费或过期的缓存（排查是否生成过但失效了）
    const consumedOrExpired = await db.drillCache.count({
        where: {
            OR: [
                { isConsumed: true },
                { expiresAt: { lte: new Date() } }
            ]
        }
    });
    console.log(`已消费或已过期的缓存: ${consumedOrExpired} 条`);
}

main()
    .catch(e => console.error(e))
    .finally(() => db.$disconnect());
