/**
 * 手动入队脚本
 * 功能：
 *   手动触发 Drill 生成任务入队
 * 使用方法：
 *   npx tsx scripts/enqueue-drill.ts --userId=xxx --mode=SYNTAX
 * 示例：
 *   npm run queue:enqueue -- --userId=test-user --mode=SYNTAX
 */
import 'dotenv/config';
import { enqueueDrillGeneration } from '@/lib/queue/inventory-queue';
import { SessionMode } from '@/types/briefing';

const args = process.argv.slice(2);
const userId = args.find((a) => a.startsWith('--userId='))?.split('=')[1];
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1];

const validModes: SessionMode[] = ['SYNTAX', 'CHUNKING', 'NUANCE', 'BLITZ', 'ARENA_PART5'];
const mode = validModes.includes(modeArg as SessionMode) ? (modeArg as SessionMode) : undefined;

if (!userId) {
    console.error('❌ 缺少 --userId 参数');
    console.log('用法: npx tsx scripts/enqueue-drill.ts --userId=xxx --mode=SYNTAX');
    process.exit(1);
}

if (!mode) {
    console.error(`❌ 无效的 mode: ${modeArg}`);
    console.log(`有效值: ${validModes.join(', ')}`);
    process.exit(1);
}

async function main() {
    console.log('🚀 开始入队...');
    console.log(`   UserId: ${userId}`);
    console.log(`   Mode: ${mode}`);

    const jobs = await enqueueDrillGeneration(userId!, mode!, 'realtime');

    console.log(`✅ ${jobs.length} 个任务已入队!`);
    for (const job of jobs) {
        console.log(`   Job ID: ${job.id}`);
        console.log(`   Correlation: ${job.data.correlationId}`);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('❌ 入队失败:', err.message);
    process.exit(1);
});
