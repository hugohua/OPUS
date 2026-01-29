/**
 * 脚本: 检查 UserProgress (FSRS 状态)
 * 功能: 
 *   查询指定用户的 FSRS 记忆参数，验证算法是否生效。
 * 
 * 使用: npx tsx scripts/inspect-user-progress.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 使用之前的 Session User ID
    const userId = 'cmkqc2y5f0001umakqjgq1856';

    console.log(`🔍 正在检查用户 FSRS 状态 (User: ${userId})`);

    const progressList = await prisma.userProgress.findMany({
        where: { userId },
        orderBy: { last_review_at: 'desc' },
        take: 5
    });

    if (progressList.length === 0) {
        console.log('❌ 未找到学习记录 (UserProgress is empty)');
        return;
    }

    console.log(`✅ 找到 ${progressList.length} 条最近记录:\n`);

    progressList.forEach((p, index) => {
        console.log(`[Record ${index + 1}] VocabID: ${p.vocabId} | Track: ${p.track}`);
        console.log(`   Status:      ${p.status} (Interval: ${p.interval}d)`);
        console.log(`   FSRS Core:   S=${p.stability.toFixed(2)}, D=${p.difficulty.toFixed(2)}, Reps=${p.reps}`);
        console.log(`   Last Review: ${p.last_review_at?.toLocaleTimeString() || 'N/A'}`);
        console.log(`   Next Review: ${p.next_review_at?.toLocaleTimeString() || 'N/A'}`);
        console.log(`   Due Date:    ${p.dueDate.toLocaleTimeString()}`);
        console.log('------------------------------------------------');
    });

    // 验证逻辑
    const hasValidFSRS = progressList.some(p => p.stability > 0 && p.interval > 0);
    if (hasValidFSRS) {
        console.log('\n🎉 FSRS 验证通过: 检测到有效的稳定性(S)与间隔(Interval)更新。');
    } else {
        console.log('\n⚠️ FSRS 警告: 所有记录似乎仍处于初始状态 (S=0)，请确认是否已提交评分。');
    }
}

main().finally(() => prisma.$disconnect());
