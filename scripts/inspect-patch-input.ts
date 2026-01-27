/**
 * 检查 Patch 输入数据结构
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 获取需要 patch 的词汇（旧格式）
    const words = await prisma.vocab.findMany({
        where: { definition_cn: { not: null } },
        select: { word: true, definition_cn: true, definitions: true },
        take: 20,
        orderBy: { word: 'asc' }
    });

    const needsPatch = words.filter(w => Array.isArray(w.definitions));

    console.log('=== Patch 脚本的输入数据（仅有 definition_cn）===\n');
    needsPatch.slice(0, 10).forEach(w => {
        console.log('[' + w.word + ']');
        console.log('  → definition_cn:', w.definition_cn);
        console.log('  → 旧 definitions (Oxford 英文):', JSON.stringify(w.definitions));
        console.log('');
    });

    console.log('=== 问题分析 ===');
    console.log('Patch Prompt 只用 definition_cn 作为输入源');
    console.log('definition_cn 通常是简单中文翻译，缺少商业语境信息');
    console.log('LLM 需要「推断」business_cn，可能导致质量不一致');
}

main().finally(() => prisma.$disconnect());
