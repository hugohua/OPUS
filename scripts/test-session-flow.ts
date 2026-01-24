
try { process.loadEnvFile(); } catch (e) { console.warn('Env not loaded via process.loadEnvFile'); }

// import { getNextBriefing } from '@/actions/game-loop';
// import { recordOutcome } from '@/actions/record-outcome';
// import { prisma } from '@/lib/prisma';

/**
 * Session Batch 流程测试脚本
 */
async function main() {
    console.log('Script disabled due to missing dependencies (game-loop action)');
}

main().catch(console.error);

export { };
