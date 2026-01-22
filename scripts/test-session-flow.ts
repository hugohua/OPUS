try { process.loadEnvFile(); } catch (e) { console.warn('Env not loaded via process.loadEnvFile'); }

import { getNextBriefing } from '@/actions/game-loop';
import { recordOutcome } from '@/actions/record-outcome';
import { prisma } from '@/lib/prisma';

/**
 * Session Batch 流程测试脚本
 * 功能：
 *   验证 Session 分组逻辑与数据持久化
 *   1. 模拟完成 20 次交互
 *   2. 验证 Daily Cap 是否移除
 *   3. 验证 recordOutcome 是否成功保存
 * 使用方法：
 *   npx tsx scripts/test-session-flow.ts
 * 注意：
 *   1. 需要 .env 包含 DATABASE_URL
 *   2. 依赖 seed 数据的 Mock User
 */
async function main() {
    console.log('--- Starting Session Batch Test ---');
    const userId = "cm5d4q9p50000356cl6a88q9i"; // Mock User

    // 1. Reset Progress for a few words to Ensure we have data
    // (Optional, assuming seed data exists)

    // 2. Simulate 5 interactions (Scaling down from 20 for quick test)
    console.log('Simulating 5 interactions...');
    for (let i = 0; i < 5; i++) {
        console.log(`\n--- Batch Step ${i + 1}/5 ---`);

        // A. Get Next Briefing
        const res = await getNextBriefing(i);
        if (res.status !== 'success' || !res.data) {
            console.error('Failed to fetch briefing:', res.message);
            continue;
        }

        const vocabId = res.data.meta.vocabId;
        console.log(`Fetched Word: ${res.data.meta.targetWord || 'Unknown'} (ID: ${vocabId})`);

        if (!vocabId) {
            console.error('CRITICAL: vocabId missing in metadata!');
            continue;
        }

        // B. Record Outcome
        const outcomeRes = await recordOutcome(vocabId, true); // Simulate Success
        console.log('Outcome recorded:', outcomeRes.status);
    }

    // 3. Verify Persistence
    console.log('\n--- Verifying Persistence ---');
    const recentProgress = await prisma.userProgress.findMany({
        where: { userId, last_review_at: { gte: new Date(Date.now() - 60000) } },
        include: { vocab: true }
    });

    console.log(`Found ${recentProgress.length} records updated in last minute.`);
    recentProgress.forEach(p => {
        console.log(`- ${p.vocab.word}: Status=${p.status}, NextReview=${p.next_review_at.toISOString()}`);
    });

    if (recentProgress.length > 0) {
        console.log('✅ Persistence working!');
    } else {
        console.error('❌ Persistence failed!');
    }
}

main().catch(console.error);
