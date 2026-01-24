/**
 * 选词逻辑验证脚本
 * 
 * 功能：
 *   验证 WordSelectionService 的选词算法，包括 Target 优先级排序、Context 场景匹配和降级策略。
 * 
 * 使用方法：
 *   npx tsx scripts/test-word-selection.ts
 * 
 * ⚠️ 注意：
 *   由于使用了 'server-only' 包，直接运行此脚本可能会报错。
 *   临时调试时，请在 `lib/services/WordSelectionService.ts` 中注释掉 `import 'server-only';`。
 */
import { WordSelectionService } from '@/lib/services/WordSelectionService';
import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

// Load Env
try { process.loadEnvFile(); } catch (e) { }

const log = createLogger('test:word-selection');

async function main() {
    const userId = 'test-user-1';
    log.info('Starting word selection test...');

    try {
        const service = new WordSelectionService(userId);
        const result = await service.getWordSelection();

        if (result) {
            console.log('\n✅ Selection Successful:');
            console.log('-----------------------------------');
            console.log(`Target:  [${result.targetWord.word}] (Priority: ${result.targetWord.learningPriority}, Scenarios: ${result.targetWord.scenarios})`);
            console.log(`Scenario: ${result.scenario}`);
            console.log('Context:');
            result.contextWords.forEach((w, i) => {
                console.log(`  ${i + 1}. [${w.word}] (Scenarios: ${w.scenarios})`);
            });
            console.log('-----------------------------------\n');
        } else {
            console.log('\n⚠️ No selection made (Check if DB has eligible words)\n');
        }

    } catch (error) {
        log.error(error, 'Test failed');
    } finally {
        await prisma.$disconnect();
    }
}

main();
