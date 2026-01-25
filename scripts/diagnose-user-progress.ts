/**
 * 诊断脚本：检查用户记忆状态
 *
 * 功能：
 * 1. 统计各状态单词数量 (NEW, LEARNING, REVIEW, MASTERED)
 * 2. 检查 FSRS 参数分布 (Stability, Difficulty)
 * 3. 检查最近复习记录
 * 4. 检查是否有 "僵尸" 数据
 */

import { PrismaClient } from '../generated/prisma/client';
import { State } from 'ts-fsrs';

// Load environment variables
try { process.loadEnvFile(); } catch (e) { console.warn("Env file not loaded"); }

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 开始诊断用户记忆状态...");

    const userId = "user_2sYMHXSQn0p739Kk19d2"; // 假设只有一个用户，或获取第一个

    const user = await prisma.user.findFirst();
    if (!user) {
        console.error("❌ 未找到用户");
        return;
    }

    console.log(`👤 用户: ${user.email} (${user.id})`);

    // 1. 状态统计
    const stats = await prisma.userProgress.groupBy({
        by: ['status'],
        where: { userId: user.id },
        _count: true
    });

    console.log("\n📊 单词状态分布:");
    stats.forEach((s: any) => {
        console.log(`   ${s.status.padEnd(10)}: ${s._count}`);
    });

    const FsrsStats = await prisma.userProgress.groupBy({
        by: ['state'],
        where: { userId: user.id },
        _count: true
    });

    console.log("\n🧠 FSRS State 分布 (0=New, 1=Learning, 2=Review, 3=Relearning):");
    FsrsStats.forEach((s: any) => {
        console.log(`   State ${s.state}: ${s._count}`);
    });

    // 2. FSRS 参数概览
    const progress = await prisma.userProgress.findMany({
        where: { userId: user.id },
        select: { stability: true, difficulty: true, reps: true, last_review_at: true, next_review_at: true, dim_v_score: true, vocab: { select: { word: true } } }
    });

    const avgStability = progress.reduce((acc: number, p: any) => acc + p.stability, 0) / (progress.length || 1);
    const avgDifficulty = progress.reduce((acc: number, p: any) => acc + p.difficulty, 0) / (progress.length || 1);
    const avgReps = progress.reduce((acc: number, p: any) => acc + p.reps, 0) / (progress.length || 1);

    console.log("\n📈 FSRS 平均参数:");
    console.log(`   Avg Stability:  ${avgStability.toFixed(2)}`);
    console.log(`   Avg Difficulty: ${avgDifficulty.toFixed(2)}`);
    console.log(`   Avg Reps:       ${avgReps.toFixed(2)}`);

    // 3. 检查异常数据
    const zombies = progress.filter((p: any) => p.state === 0 && p.reps > 0);
    if (zombies.length > 0) {
        console.warn(`\n🧟 发现 ${zombies.length} 个僵尸记录 (State=New 但 Reps>0):`);
        console.log(zombies.slice(0, 3).map((z: any) => z.vocab.word));
    } else {
        console.log("\n✅ 未发现僵尸记录");
    }

    // 4. 最近活动
    const recent = progress
        .filter((p: any) => p.last_review_at)
        .sort((a: any, b: any) => b.last_review_at!.getTime() - a.last_review_at!.getTime())
        .slice(0, 10);

    console.log("\n⏱️ 最近 10 个复习单词:");
    recent.forEach((p: any) => {
        const timeAgo = Math.floor((Date.now() - p.last_review_at!.getTime()) / 1000 / 60);
        console.log(`   ${p.vocab.word.padEnd(15)} | Reps: ${p.reps} | S: ${p.stability.toFixed(1)} | Next: ${p.next_review_at?.toISOString().slice(0, 16)} (${timeAgo} mins ago)`);
    });

    // 5. Future Queue Preview
    const now = new Date();
    const futureDue = progress.filter((p: any) => p.next_review_at && p.next_review_at > now).length;
    const dueNow = progress.filter((p: any) => p.next_review_at && p.next_review_at <= now).length;

    console.log("\n📅 队列概况:");
    console.log(`   🔴 待复习 (Due Now): ${dueNow}`);
    console.log(`   🟢 未来待复习 (Future): ${futureDue}`);

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
