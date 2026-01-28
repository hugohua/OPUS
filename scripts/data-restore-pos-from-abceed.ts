
/**
 * 词性数据恢复脚本
 * 
 * 功能：
 *   从 raw_data/abceed.json 读取原始数据，恢复数据库中丢失的 partOfSpeech 字段。
 *   使用与 data-fix-pos-normalization.ts 相同的归一化映射。
 * 
 * 使用方法：
 *   npx tsx scripts/data-restore-pos-from-abceed.ts
 */
try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

const POS_MAP: Record<string, string> = {
    // 名词
    '名詞': 'n.',
    'noun': 'n.',
    'n.': 'n.',

    // 动词
    '動詞': 'v.',
    'verb': 'v.',
    'v.': 'v.',
    'modal verb': 'v.',
    'auxiliary verb': 'v.',
    'linking verb': 'v.',

    // 形容词
    '形容詞': 'adj.',
    'adjective': 'adj.',
    'adj.': 'adj.',

    // 副词
    '副詞': 'adv.',
    'adverb': 'adv.',
    'adv.': 'adv.',

    // 代词
    'pronoun': 'pron.',
    'pron.': 'pron.',

    // 介词
    'preposition': 'prep.',
    'prep.': 'prep.',
    '前置詞': 'prep.',

    // 连词
    'conjunction': 'conj.',
    'conj.': 'conj.',

    // 数词
    'number': 'num.',
    'ordinal number': 'num.',
    'num.': 'num.',

    // 感叹词
    'exclamation': 'excl.',
    'interjection': 'excl.',
    'excl.': 'excl.',

    // 限定词
    'determiner': 'det.',
    'det.': 'det.',

    // 冠词
    'indefinite article': 'art.',
    'definite article': 'art.',
    'art.': 'art.',

    // 习语/短语
    'イディオム': 'idiom',
    'idiom': 'idiom',
};

async function main() {
    console.log('开始从 abceed.json 恢复词性数据...');

    const rawDataPath = path.join(process.cwd(), 'raw_data', 'abceed.json');
    const rawContent = await fs.readFile(rawDataPath, 'utf-8');
    const rawData = JSON.parse(rawContent);

    console.log(`读取到 ${rawData.length} 条原始记录`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    // 批量处理，每次 100 条
    const batchSize = 100;
    for (let i = 0; i < rawData.length; i += batchSize) {
        const batch = rawData.slice(i, i + batchSize);

        await Promise.all(batch.map(async (item: any) => {
            const word = item.word;
            const rawPos = item.part_of_speech; // 假设原始字段名是 part_of_speech

            if (!word || !rawPos) {
                skippedCount++;
                return;
            }

            // 归一化
            const normalizedPos = POS_MAP[rawPos] || rawPos;

            // 更新数据库
            try {
                const result = await prisma.vocab.updateMany({
                    where: {
                        word: word,
                        partOfSpeech: null // 只修复缺失的
                    },
                    data: {
                        partOfSpeech: normalizedPos
                    }
                });

                if (result.count > 0) {
                    updatedCount += result.count;
                } else {
                    // 可能是单词不在库里，或者已经有 POS 了
                    // 检查是否存在通过 updateMany 比较困难，这里简化逻辑只统计更新数
                }
            } catch (e) {
                console.error(`更新单词 ${word} 失败:`, e);
            }
        }));

        if ((i + batchSize) % 1000 === 0) {
            console.log(`已处理 ${i + batchSize} / ${rawData.length} ... (已更新: ${updatedCount})`);
        }
    }

    console.log(`\n恢复完成！`);
    console.log(`- 读取总数: ${rawData.length}`);
    console.log(`- 成功更新: ${updatedCount}`);
    console.log(`- 跳过无效: ${skippedCount}`);

    // 再次运行统计
    const finalCount = await prisma.vocab.count({ where: { partOfSpeech: null } });
    console.log(`\n剩余未修复 (partOfSpeech IS NULL): ${finalCount}`);
}

main()
    .catch(err => {
        console.error('修复脚本运行失败:', err);
    })
    .finally(() => prisma.$disconnect());
