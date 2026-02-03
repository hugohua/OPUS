/**
 * 全景审计系统 - 健康检查报告
 * 
 * 用法: npx tsx scripts/audit-report.ts
 * 
 * 输出:
 * - 各链路审计覆盖率
 * - 异常率统计
 * - Top 异常词汇
 * - FSRS 健康指标
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditStats {
    contextMode: string;
    _count: number;
}

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           🔍 Opus 全景审计系统 - 健康检查报告              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. 总览统计
    const totalRecords = await prisma.drillAudit.count();
    const last24h = await prisma.drillAudit.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });

    console.log('📊 总览');
    console.log('─'.repeat(50));
    console.log(`   总审计记录:    ${totalRecords}`);
    console.log(`   最近 24h 新增: ${last24h}`);
    console.log('');

    // 2. 按 contextMode 分布
    const byMode = await prisma.drillAudit.groupBy({
        by: ['contextMode'],
        _count: true,
        orderBy: { _count: { contextMode: 'desc' } }
    }) as unknown as AuditStats[];

    console.log('📈 链路覆盖分布');
    console.log('─'.repeat(50));

    // 分类汇总
    let ompsCount = 0, fsrsCount = 0, l0Count = 0, l1Count = 0, l2Count = 0, otherCount = 0;

    for (const row of byMode) {
        const mode = row.contextMode || 'NULL';
        const count = row._count;

        if (mode.startsWith('OMPS:')) ompsCount += count;
        else if (mode.startsWith('FSRS:')) fsrsCount += count;
        else if (mode.startsWith('L0:')) l0Count += count;
        else if (mode.startsWith('L1:')) l1Count += count;
        else if (mode.startsWith('L2:')) l2Count += count;
        else otherCount += count;

        const bar = '█'.repeat(Math.min(30, Math.ceil(count / Math.max(1, totalRecords) * 60)));
        console.log(`   ${mode.padEnd(20)} ${String(count).padStart(5)} ${bar}`);
    }

    console.log('');
    console.log('📍 链路汇总');
    console.log('─'.repeat(50));
    console.log(`   选词逻辑 (OMPS):     ${ompsCount}`);
    console.log(`   记忆调度 (FSRS):     ${fsrsCount}`);
    console.log(`   LLM 生成 (L0):       ${l0Count}`);
    console.log(`   LLM 生成 (L1):       ${l1Count}`);
    console.log(`   LLM 生成 (L2):       ${l2Count}`);
    if (otherCount > 0) console.log(`   其他/旧格式:         ${otherCount}`);
    console.log('');

    // 3. 异常标记统计
    const withTags = await prisma.drillAudit.count({
        where: { auditTags: { isEmpty: false } }
    });

    const anomalyRate = totalRecords > 0 ? ((withTags / totalRecords) * 100).toFixed(2) : '0.00';

    console.log('⚠️ 异常检测');
    console.log('─'.repeat(50));
    console.log(`   带异常标记的记录: ${withTags}`);
    console.log(`   异常率:           ${anomalyRate}%`);

    // 获取异常标记详情
    const anomalies = await prisma.drillAudit.findMany({
        where: { auditTags: { isEmpty: false } },
        select: { auditTags: true, targetWord: true, contextMode: true },
        take: 100
    });

    // 统计每种标签的出现次数
    const tagCounts: Record<string, number> = {};
    for (const record of anomalies) {
        for (const tag of record.auditTags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
    }

    if (Object.keys(tagCounts).length > 0) {
        console.log('\n   标签分布:');
        for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
            console.log(`     • ${tag}: ${count}`);
        }
    }
    console.log('');

    // 4. FSRS 健康指标
    const fsrsRecords = await prisma.drillAudit.findMany({
        where: { contextMode: 'FSRS:TRANSITION' },
        select: { payload: true },
        take: 1000
    });

    if (fsrsRecords.length > 0) {
        let againCount = 0, goodCount = 0, easyCount = 0, hardCount = 0;
        let stabilityGrowth = 0, stabilityDrop = 0;

        for (const record of fsrsRecords) {
            const payload = record.payload as any;
            const grade = payload?.context?.grade;
            const prevStability = payload?.context?.prevStability || 0;
            const newStability = payload?.decision?.newStability || 0;

            if (grade === 1) againCount++;
            else if (grade === 2) hardCount++;
            else if (grade === 3) goodCount++;
            else if (grade === 4) easyCount++;

            if (newStability > prevStability) stabilityGrowth++;
            else if (newStability < prevStability) stabilityDrop++;
        }

        const total = fsrsRecords.length;
        console.log('🧠 FSRS 记忆健康');
        console.log('─'.repeat(50));
        console.log(`   评分分布 (最近 ${total} 次):`);
        console.log(`     • Again (1): ${againCount} (${((againCount / total) * 100).toFixed(1)}%)`);
        console.log(`     • Hard (2):  ${hardCount} (${((hardCount / total) * 100).toFixed(1)}%)`);
        console.log(`     • Good (3):  ${goodCount} (${((goodCount / total) * 100).toFixed(1)}%)`);
        console.log(`     • Easy (4):  ${easyCount} (${((easyCount / total) * 100).toFixed(1)}%)`);
        console.log('');
        console.log(`   稳定性变化:`);
        console.log(`     • 增长: ${stabilityGrowth}`);
        console.log(`     • 下降: ${stabilityDrop} ${stabilityDrop > stabilityGrowth * 0.3 ? '⚠️ 偏高' : '✅'}`);
        console.log('');
    }

    // 5. Top 问题词汇 (多次出现异常)
    const problemWords = await prisma.drillAudit.groupBy({
        by: ['targetWord'],
        where: { auditTags: { isEmpty: false } },
        _count: true,
        orderBy: { _count: { targetWord: 'desc' } },
        take: 5
    });

    if (problemWords.length > 0) {
        console.log('🔴 Top 问题词汇 (多次异常)');
        console.log('─'.repeat(50));
        for (const word of problemWords) {
            console.log(`   ${word.targetWord}: ${word._count} 次异常`);
        }
        console.log('');
    }

    // 6. 最近异常记录
    const recentAnomalies = await prisma.drillAudit.findMany({
        where: { auditTags: { isEmpty: false } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            targetWord: true,
            contextMode: true,
            auditTags: true,
            createdAt: true
        }
    });

    if (recentAnomalies.length > 0) {
        console.log('📜 最近异常记录');
        console.log('─'.repeat(50));
        for (const record of recentAnomalies) {
            const time = record.createdAt.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`   [${time}] ${record.targetWord}`);
            console.log(`     模式: ${record.contextMode}`);
            console.log(`     标签: ${record.auditTags.join(', ')}`);
        }
        console.log('');
    }

    // 7. 健康评分
    console.log('╔════════════════════════════════════════════════════════════╗');

    const healthScore = calculateHealthScore({
        totalRecords,
        anomalyRate: parseFloat(anomalyRate),
        ompsCount,
        fsrsCount,
        l0Count
    });

    const emoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';
    console.log(`║  ${emoji} 系统健康评分: ${healthScore}/100                               ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

function calculateHealthScore(stats: {
    totalRecords: number;
    anomalyRate: number;
    ompsCount: number;
    fsrsCount: number;
    l0Count: number;
}): number {
    let score = 100;

    // 扣分项
    if (stats.totalRecords < 10) score -= 20; // 数据量不足
    if (stats.anomalyRate > 10) score -= 15;  // 异常率过高
    if (stats.anomalyRate > 20) score -= 15;  // 异常率极高
    if (stats.ompsCount === 0) score -= 10;   // OMPS 无覆盖
    if (stats.fsrsCount === 0) score -= 10;   // FSRS 无覆盖
    if (stats.l0Count === 0) score -= 10;     // LLM 无覆盖

    return Math.max(0, score);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
