/**
 * 脚本: 全链路仿真测试 (E2E Simulation Flow V2)
 * 
 * 功能：
 *   验证 Phase 2 的 "Zero-Wait" 核心循环：
 *   1. 冷启动 (Cold Start) -> 预期返回兜底数据 (Fallback)
 *   2. 触发补货 (Trigger) -> 预期后台生成 (需配合 Worker 运行)
 *   3. 热启动 (Warm Hit) -> 预期缓存命中 (Cache Hit)
 * 
 * 使用方法：
 *   npx tsx scripts/sim-flow-v2.ts --userId=<cuid> --mode=SYNTAX
 */

import { getNextDrillBatch } from '@/actions/get-next-drill';
import { inventory } from '@/lib/inventory';
import { redis } from '@/lib/queue/connection';
import { SessionMode } from '@/types/briefing';

// 简单延时函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    // 默认测试配置 (Use a valid CUID format)
    const userId = 'cm66x5x5x000008l4am90956r'; // Pre-generated CUID
    const mode: SessionMode = 'SYNTAX';
    console.log(`\n🎰 开始 E2E 仿真测试 (User: ${userId}, Mode: ${mode})`);
    console.log('==================================================');

    // 1. 清理环境 (Reset)
    console.log('\n🧹 [Step 1] 清理测试环境...');
    const listKey = `user:${userId}:mode:${mode}:vocab:*:drills`;
    // 清除该模式下的所有库存
    const keys = await redis.keys(listKey);
    if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`   已清除 ${keys.length} 个 Redis Key`);
    }
    // 重置统计
    await redis.hdel(`user:${userId}:inventory:stats`, mode);
    console.log('   环境已重置');

    // 2. 冷启动请求 (Cold Start)
    console.log('\n❄️ [Step 2] 发起冷启动请求...');
    const t0 = Date.now();
    const coldResult = await getNextDrillBatch({
        userId,
        mode,
        limit: 5,
        forceRefresh: true // 确保不读本地缓存
    });
    const t1 = Date.now();

    if (coldResult.status !== 'success' || !coldResult.data) {
        throw new Error('冷启动请求失败');
    }

    console.log(`   耗时: ${t1 - t0}ms`);
    console.log(`   返回数量: ${coldResult.data.length}`);

    // 验证是否为兜底数据
    const fallbackCount = coldResult.data.filter(d => (d.meta as any).source === 'deterministic_fallback').length;
    console.log(`   兜底数据占比: ${fallbackCount}/${coldResult.data.length}`);

    if (fallbackCount === coldResult.data.length) {
        console.log('   ✅ 符合预期：全部为兜底数据 (Cold Start)');
    } else {
        console.log('   ⚠ 警告：发现非兜底数据 (可能是上次测试残留)');
    }

    // 3. 验证补货触发 (Replenishment Trigger)
    console.log('\n🔍 [Step 3] 验证后台生成 (Real Worker)...');
    console.log('   ⏳ 等待 Worker 生成 (Max 60s)...');

    // Polling Queue / Inventory
    let retries = 0;
    const maxRetries = 20; // 20 * 3s = 60s
    let hasInventory = false;

    // Check inventory for the first few vocabIds
    const checkVocabIds = coldResult.data.map(d => (d.meta as any).vocabId).slice(0, 3);

    while (retries < maxRetries) {
        await sleep(3000);
        process.stdout.write('.');

        // Check if any inventory exists
        const counts = await inventory.getInventoryCounts(userId, mode, checkVocabIds);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        if (total > 0) {
            console.log(`\n   ✅ 检测到库存生成: ${total} Items`);
            hasInventory = true;
            break;
        }
        retries++;
    }

    if (!hasInventory) {
        console.warn('\n   ⚠ 超时：Worker 未能在 60s 内生成数据 (请检查 Worker 日志)');
        // Continue anyway to see if next fetch hits anything
    }


    // 4. 热启动请求 (Warm Hit)
    console.log('\n🔥 [Step 4] 发起热启动请求...');
    const warmResult = await getNextDrillBatch({
        userId,
        mode,
        limit: 5
    });

    const cacheHitCount = warmResult.data?.filter(d => (d.meta as any).source === 'cache_v2').length;
    console.log(`   缓存命中: ${cacheHitCount}/${warmResult.data?.length}`);

    if (cacheHitCount && cacheHitCount > 0) {
        console.log('   ✅ 符合预期：命中缓存 (Zero-Wait Success)');
    } else {
        console.log('   ❌ 失败：未命中缓存 (Worker 可能未工作)');
    }

    console.log('\n🎉 E2E 仿真结束');
    process.exit(0);
}

// 模拟 Worker 生成数据并推送到 Redis
async function mockWorkerGeneration(userId: string, mode: string, vocabIds: number[]) {
    console.log('   🤖 [Mock Worker] 正在生成数据...');
    for (const vid of vocabIds) {
        // 模拟一个简单的 Payload
        const payload = {
            meta: {
                format: 'chat',
                mode,
                vocabId: vid,
                source: 'llm_v2', // 标记为 V2 生成
                target_word: 'mock'
            },
            segments: [
                { type: 'text', content_markdown: 'Mock Generated Content' }
            ]
        };
        // 推送库存
        await inventory.pushDrill(userId, mode, vid, payload as any);
    }
    console.log(`   🤖 [Mock Worker] 已生成并推送 ${vocabIds.length} 条数据`);
}

main().catch(console.error);
