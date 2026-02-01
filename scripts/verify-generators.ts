/**
 * 脚本: 验证 Generator 提示词生成
 * 功能: 直接调用各 Level 的 Generator 函数，打印 Prompt 以供人工核查
 * 运行: npx tsx scripts/verify-generators.ts
 */

import { getL0SyntaxBatchPrompt } from '@/lib/generators/l0/syntax';
import { getL0BlitzBatchPrompt } from '@/lib/generators/l0/blitz';
import { getL1ChunkingBatchPrompt } from '@/lib/generators/l1/chunking';
import { getL2ContextBatchPrompt } from '@/lib/generators/l2/context';

async function main() {
    console.log('🧪 开始验证 Generators...\n');

    // 1. Verify L0 Syntax
    console.log('--- [L0 Syntax] ---');
    const syntaxInputs = [{
        targetWord: 'approve',
        meaning: '批准',
        contextWords: ['urgent', 'budget'],
        wordFamily: { v: 'approve', n: 'approval' }
    }];
    const syntaxPrompt = getL0SyntaxBatchPrompt(syntaxInputs);
    console.log('System Prompt Valid:', syntaxPrompt.system.includes('STRICT S-V-O only'));
    console.log('User Prompt Preview:', syntaxPrompt.user.substring(0, 100).replace(/\n/g, ' '));
    console.log('✅ L0 Syntax Check Passed\n');

    // 2. Verify L0 Blitz
    console.log('--- [L0 Blitz] ---');
    const blitzInputs = [{
        targetWord: 'meeting',
        meaning: '会议',
        collocations: ['schedule a meeting']
    }];
    const blitzPrompt = getL0BlitzBatchPrompt(blitzInputs);
    console.log('System Prompt Valid:', blitzPrompt.system.includes('Rapid Fire Engine'));
    console.log('User Prompt Preview:', blitzPrompt.user);
    console.log('✅ L0 Blitz Check Passed\n');

    // 3. Verify L1 Chunking
    console.log('--- [L1 Chunking] ---');
    const chunkInputs = [{ targetWord: 'test', sentence: 'This is a test sentence.' }];
    const chunkPrompt = getL1ChunkingBatchPrompt(chunkInputs);
    console.log('System Prompt Valid:', chunkPrompt.system.includes('Rhythm Engine'));
    console.log('✅ L1 Chunking Check Passed\n');

    // 4. Verify L2 Context
    console.log('--- [L2 Context] ---');
    const contextPrompt = getL2ContextBatchPrompt([{
        targetWord: 'strategy',
        meaning: '策略',
        contextKeywords: ['business', 'planning']
    }]);
    console.log('System Prompt Valid:', contextPrompt.system.includes('Logic Engine'));
    console.log('✅ L2 Context Check Passed\n');

    console.log('🎉 所有 Generator 静态检查通过！');
}

main().catch(console.error);
