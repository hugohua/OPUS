
/**
 * 词性数据恢复脚本 (Source: Oxford 5000)
 * 
 * 功能：
 *   从 raw_data/oxford_5000.json 读取原始数据，恢复数据库中丢失的 partOfSpeech 字段。
 *   映射关系：
 *   type: "noun" -> "n."
 *   type: "verb" -> "v."
 *   ...
 * 
 * 使用方法：
 *   npx tsx scripts/data-restore-pos-from-oxford.ts
 */
try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const POS_MAP: Record<string, string> = {
    // 名词
    'noun': 'n.',

    // 动词
    'verb': 'v.',
    'modal verb': 'v.',
    'auxiliary verb': 'v.',
    'linking verb': 'v.',
    'phrasal verb': 'v.',

    // 形容词
    'adjective': 'adj.',

    // 副词
    'adverb': 'adv.',

    // 代词
    'pronoun': 'pron.',

    // 介词
    'preposition': 'prep.',

    // 连词
    'conjunction': 'conj.',

    // 数词
    'number': 'num.',
    'ordinal number': 'num.',
    'cardinal number': 'num.',

    // 感叹词
    'exclamation': 'excl.',
    'interjection': 'excl.',

    // 限定词
    'determiner': 'det.',

    // 冠词
    'article': 'art.',
    'indefinite article': 'art.',
    'definite article': 'art.',
};

async function main() {
    console.log('开始从 oxford_5000.json 恢复词性数据...');

    const rawDataPath = path.join(process.cwd(), 'raw_data', 'oxford_5000.json');
    const rawContent = await fs.readFile(rawDataPath, 'utf-8');
    const rawData = JSON.parse(rawContent);

    // rawData is an object with numeric keys: "0": {...}, "1": {...}
    const entries = Object.values(rawData);
    console.log(`读取到 ${entries.length} 条原始记录`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 批量处理，每次 100 条
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        await Promise.all(batch.map(async (item: any) => {
            const word = item.word;
            const rawType = item.type;

            if (!word || !rawType) {
                skippedCount++;
                return;
            }

            // 归一化
            const normalizedPos = POS_MAP[rawType];

            if (!normalizedPos) {
                // If mapping not found, skip or log?
                // console.log(`未知词性: ${rawType} (${word})`);
                return;
            }

            // 更新数据库
            try {
                // 仅更新当前为 null 的记录
                const result = await prisma.vocab.updateMany({
                    where: {
                        word: word,
                        partOfSpeech: null
                    },
                    data: {
                        partOfSpeech: normalizedPos
                    }
                });

                if (result.count > 0) {
                    updatedCount += result.count;
                }
            } catch (e) {
                // console.error(`更新单词 ${word} 失败:`, e);
            }
        }));

        if ((i + batchSize) % 5000 === 0) {
            console.log(`已处理 ${i + batchSize} / ${entries.length} ... (已更新: ${updatedCount})`);
        }
    }

    console.log(`\n恢复完成！`);
    console.log(`- 读取总数: ${entries.length}`);
    console.log(`- 成功更新: ${updatedCount}`);

    // 再次运行统计
    const finalCount = await prisma.vocab.count({ where: { partOfSpeech: null } });
    const totalCount = await prisma.vocab.count();
    console.log(`\n数据库统计:`);
    console.log(`- 总单词数: ${totalCount}`);
    console.log(`- 剩余未修复 (partOfSpeech IS NULL): ${finalCount}`);
    console.log(`- 已覆盖率: ${((totalCount - finalCount) / totalCount * 100).toFixed(1)}%`);
}

main()
    .catch(err => {
        console.error('修复脚本运行失败:', err);
    })
    .finally(() => prisma.$disconnect());
