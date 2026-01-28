/**
 * OMPS 仿真测试脚本
 * 
 * 功能：
 *   模拟真实用户使用场景，验证 OMPS 在多批次请求下的行为。
 *   输出统计数据用于验证配比是否符合预期。
 * 
 * 使用方法：
 *   npx tsx scripts/sim-omps-full.ts --userId=<cuid> --batches=10
 */

import { getNextDrillBatch } from '@/actions/get-next-drill';
import { BriefingPayload } from '@/types/briefing';

// 加载环境变量
try { process.loadEnvFile(); } catch { }

// ============================================
// 配置
// ============================================

interface SimConfig {
    userId: string;
    batches: number;
    batchSize: number;
    mode: 'SYNTAX' | 'PHRASE';
}

function parseArgs(): SimConfig {
    const args = process.argv.slice(2);
    const config: SimConfig = {
        userId: 'cm66x5x5x000008l4am90956r',
        batches: 10,
        batchSize: 10,
        mode: 'SYNTAX'
    };

    for (const arg of args) {
        const [key, val] = arg.replace('--', '').split('=');
        if (key === 'userId') config.userId = val;
        if (key === 'batches') config.batches = parseInt(val);
        if (key === 'batchSize') config.batchSize = parseInt(val);
        if (key === 'mode') config.mode = val as 'SYNTAX' | 'PHRASE';
    }

    return config;
}

// ============================================
// 统计收集器
// ============================================

interface BatchStats {
    batchIndex: number;
    total: number;
    reviewCount: number;
    newCount: number;
    sources: { [key: string]: number };
    vocabIds: number[];
}

interface SimulationReport {
    config: SimConfig;
    batches: BatchStats[];
    totals: {
        totalItems: number;
        totalReviews: number;
        totalNew: number;
        reviewRatio: number;
        newRatio: number;
        uniqueVocabCount: number;
        duplicateCount: number;
    };
    sourceBreakdown: { [key: string]: number };
}

// ============================================
// 主函数
// ============================================

async function runSimulation(): Promise<SimulationReport> {
    const config = parseArgs();

    console.log('\n🎰 OMPS 仿真测试');
    console.log('='.repeat(50));
    console.log(`用户 ID: ${config.userId}`);
    console.log(`批次数: ${config.batches}`);
    console.log(`每批大小: ${config.batchSize}`);
    console.log(`模式: ${config.mode}`);
    console.log('='.repeat(50));

    const allBatchStats: BatchStats[] = [];
    const allVocabIds: number[] = [];
    const sourceBreakdown: { [key: string]: number } = {};

    for (let i = 0; i < config.batches; i++) {
        console.log(`\n📦 批次 ${i + 1}/${config.batches}...`);

        const result = await getNextDrillBatch({
            userId: config.userId,
            mode: config.mode,
            limit: config.batchSize,
            excludeVocabIds: allVocabIds // 排除已加载的词汇
        });

        if (result.status !== 'success' || !result.data) {
            console.error(`❌ 批次 ${i + 1} 失败:`, result.message);
            continue;
        }

        const batch = result.data;
        const stats = analyzeBatch(batch, i);

        allBatchStats.push(stats);
        allVocabIds.push(...stats.vocabIds);

        // 累计来源统计
        for (const [source, count] of Object.entries(stats.sources)) {
            sourceBreakdown[source] = (sourceBreakdown[source] || 0) + count;
        }

        // 打印批次摘要
        console.log(`   ✅ 获取 ${stats.total} 个词汇`);
        console.log(`   📊 复习: ${stats.reviewCount} | 新词: ${stats.newCount}`);
        console.log(`   🔗 来源: ${Object.entries(stats.sources).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    }

    // 汇总统计
    const totalItems = allBatchStats.reduce((sum, b) => sum + b.total, 0);
    const totalReviews = allBatchStats.reduce((sum, b) => sum + b.reviewCount, 0);
    const totalNew = allBatchStats.reduce((sum, b) => sum + b.newCount, 0);
    const uniqueVocabIds = new Set(allVocabIds);

    const report: SimulationReport = {
        config,
        batches: allBatchStats,
        totals: {
            totalItems,
            totalReviews,
            totalNew,
            reviewRatio: totalItems > 0 ? totalReviews / totalItems : 0,
            newRatio: totalItems > 0 ? totalNew / totalItems : 0,
            uniqueVocabCount: uniqueVocabIds.size,
            duplicateCount: allVocabIds.length - uniqueVocabIds.size
        },
        sourceBreakdown
    };

    return report;
}

function analyzeBatch(batch: BriefingPayload[], index: number): BatchStats {
    const vocabIds = batch.map(d => (d.meta as any).vocabId).filter(Boolean);
    const sources: { [key: string]: number } = {};

    for (const drill of batch) {
        const source = (drill.meta as any).source || 'unknown';
        sources[source] = (sources[source] || 0) + 1;
    }

    // 注意：当前实现没有在 meta 中标记 type (REVIEW/NEW)
    // 我们通过 source 来推断：cache_v2 通常是 REVIEW，deterministic_fallback 通常是 NEW
    const reviewCount = 0; // 需要后端在 meta 中标记
    const newCount = 0;

    return {
        batchIndex: index,
        total: batch.length,
        reviewCount,
        newCount,
        sources,
        vocabIds
    };
}

// ============================================
// 报告打印
// ============================================

function printReport(report: SimulationReport): void {
    console.log('\n');
    console.log('='.repeat(50));
    console.log('📊 仿真报告');
    console.log('='.repeat(50));

    console.log('\n📈 总体统计:');
    console.log(`   总词汇数: ${report.totals.totalItems}`);
    console.log(`   唯一词汇: ${report.totals.uniqueVocabCount}`);
    console.log(`   重复词汇: ${report.totals.duplicateCount}`);

    console.log('\n🔗 来源分布:');
    for (const [source, count] of Object.entries(report.sourceBreakdown)) {
        const pct = ((count / report.totals.totalItems) * 100).toFixed(1);
        console.log(`   ${source}: ${count} (${pct}%)`);
    }

    console.log('\n📊 批次详情:');
    console.log('   批次 | 总数 | 来源分布');
    console.log('   ' + '-'.repeat(45));
    for (const batch of report.batches) {
        const sourceStr = Object.entries(batch.sources).map(([k, v]) => `${k}:${v}`).join(' ');
        console.log(`   ${(batch.batchIndex + 1).toString().padStart(4)} | ${batch.total.toString().padStart(4)} | ${sourceStr}`);
    }

    // 验证断言
    console.log('\n✅ 验证结果:');

    // 1. 无重复词汇
    if (report.totals.duplicateCount === 0) {
        console.log('   ✓ 无重复词汇');
    } else {
        console.log(`   ✗ 发现 ${report.totals.duplicateCount} 个重复词汇`);
    }

    // 2. 批次完整性
    const incompleteBatches = report.batches.filter(b => b.total < report.config.batchSize);
    if (incompleteBatches.length === 0) {
        console.log('   ✓ 所有批次完整');
    } else {
        console.log(`   ⚠ ${incompleteBatches.length} 个批次不完整`);
    }

    console.log('\n🎉 仿真完成！');
}

// ============================================
// 入口
// ============================================

runSimulation()
    .then(printReport)
    .catch(console.error);
