/**
 * 测试 Generate Briefing Action
 * 
 * 使用方法：
 *   npx tsx scripts/test-generate-briefing.ts
 * 
 * 注意：
 *   1. 需要配置环境变量 (OPENAI_API_KEY, OPENAI_BASE_URL, AI_MODEL_NAME)
 *   2. 可选配置 HTTPS_PROXY
 */

// 加载环境变量
try { process.loadEnvFile(); } catch { /* ignore */ }

import { generateBriefingAction } from '../actions/generate-briefing';

async function main() {
    console.log('=== Testing Generate Briefing Action ===\n');

    // Test Case 1: Normal generation
    console.log('--- Test Case 1: Normal Generation ---');
    const result1 = await generateBriefingAction({
        targetWord: 'reject',
        meaning: '拒绝/驳回',
        contextWords: ['manager', 'budget', 'urgent'],
        wordFamily: { v: 'reject', n: 'rejection' },
        todayCount: 5,
    });
    console.log('Status:', result1.status);
    console.log('Message:', result1.message);
    console.log('Data:', JSON.stringify(result1.data, null, 2));

    console.log('\n');

    // Test Case 2: Daily Cap Reached
    console.log('--- Test Case 2: Daily Cap Reached ---');
    const result2 = await generateBriefingAction({
        targetWord: 'confirm',
        meaning: '确认',
        todayCount: 20,
    });
    console.log('Status:', result2.status);
    console.log('Message:', result2.message);
    console.log('Data:', JSON.stringify(result2.data, null, 2));
}

main().catch(console.error);
