/**
 * 检查脚本：查找需要 Patch definitions 字段的词汇
 * 
 * 功能：
 *   扫描数据库，找出 definitions 字段为旧格式（数组）或缺失的词汇
 * 
 * 使用方法：
 *   npx tsx scripts/inspect-patch-candidates.ts
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== 检查需要 Patch 的词汇 ===\n');

    const words = await prisma.vocab.findMany({
        where: { definition_cn: { not: null } },
        select: {
            id: true,
            word: true,
            definition_cn: true,
            definitions: true
        },
        orderBy: { word: 'asc' }
    });

    console.log(`总词汇数（有 definition_cn）: ${words.length}`);

    // 分类统计
    const stats = {
        null_definitions: 0,
        array_definitions: 0,
        missing_general_cn: 0,
        valid: 0
    };

    const needsPatch: typeof words = [];

    for (const w of words) {
        if (!w.definitions) {
            stats.null_definitions++;
            needsPatch.push(w);
        } else if (Array.isArray(w.definitions)) {
            stats.array_definitions++;
            needsPatch.push(w);
        } else {
            const defs = w.definitions as any;
            if (!defs.general_cn || typeof defs.general_cn !== 'string') {
                stats.missing_general_cn++;
                needsPatch.push(w);
            } else {
                stats.valid++;
            }
        }
    }

    console.log('\n=== 统计结果 ===');
    console.log(`✅ 已是正确格式: ${stats.valid}`);
    console.log(`❌ definitions 为 null: ${stats.null_definitions}`);
    console.log(`❌ definitions 为数组（旧格式）: ${stats.array_definitions}`);
    console.log(`❌ 缺少 general_cn: ${stats.missing_general_cn}`);
    console.log(`\n📋 总计需要 Patch: ${needsPatch.length}`);

    if (needsPatch.length > 0) {
        console.log('\n=== 示例（前 20 条）===');
        for (const w of needsPatch.slice(0, 20)) {
            console.log(`\n[${w.word}]`);
            console.log(`  definition_cn: ${w.definition_cn}`);
            console.log(`  definitions: ${JSON.stringify(w.definitions)}`);
        }
    }
}

main()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
