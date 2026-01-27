/**
 * Debug Word Selection Script
 * 
 * 功能：
 *   手动触发 WordSelectionService 的选词逻辑，验证向量搜索是否生效。
 *   对比 "Vector Search" 和 "Tag Fallback" 的结果。
 * 
 * 使用方法：
 *   npx tsx scripts/debug-word-selection.ts [userId]
 */

import { PrismaClient } from '@prisma/client';
import { WordSelectionService } from '../lib/services/WordSelectionService';
import { createLogger } from '../lib/logger';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('debug-selection');
const prisma = new PrismaClient();

async function main() {
    const userId = process.argv[2] || 'test-user-1';
    log.info({ userId }, 'Starting Debug Script');

    const service = new WordSelectionService(userId);

    // 1. Select Target Word
    const targetWord = await service.selectTargetWord();
    if (!targetWord) {
        log.warn('No target word found. Please ensure DB has unlearned words with learningPriority >= 60.');
        return;
    }

    log.info({
        id: targetWord.id,
        word: targetWord.word,
        scenarios: targetWord.scenarios
    }, 'Selected Target Word');

    // 2. Select Context Words (Hybrid Mode)
    const contextWords = await service.selectContextWords(targetWord, 5);

    console.log('\n--- Context Words Result ---');
    if (contextWords.length === 0) {
        console.log('No context words found.');
    } else {
        contextWords.forEach((w, index) => {
            console.log(`[${index + 1}] ${w.word} (ID: ${w.id})`);
            // Note: We can't easily see if it came from Vector or Tag here without more detailed logs or return types,
            // but the Service logs will show "Context selected via Vector" or "Fallback".
        });
    }
    console.log('----------------------------\n');

    // 3. Optional: Inspect Vector Distance manually if valid
    // This helps us verify if the order makes sense
    if (contextWords.length > 0) {
        // Just checking the first one if it has embedding
        const firstCtx = contextWords[0];
        const dist = await prisma.$queryRaw<any[]>`
            SELECT embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetWord.id}) as dist
            FROM "Vocab"
            WHERE id = ${firstCtx.id}
        `;
        if (dist && dist.length > 0) {
            console.log(`Distance check (Target <-> First Context): ${dist[0].dist}`);
        }
    }
}

main()
    .catch(e => {
        log.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
