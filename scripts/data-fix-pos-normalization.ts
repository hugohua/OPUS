/**
 * 词性归一化修复脚本
 * 
 * 功能：
 *   将数据库中混乱的 partOfSpeech 字段统一为标准英文缩写。
 * 
 * 使用方法：
 *   npx tsx scripts/data-fix-pos-normalization.ts
 */
try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '../generated/prisma/client';

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
    console.log('开始词性归一化修复...');

    let totalUpdated = 0;

    for (const [raw, normalized] of Object.entries(POS_MAP)) {
        // 如果原始值和目标值相同，跳过（或者统一处理也可以）
        if (raw === normalized) {
            // 我们还是检查一下是否有不规范的大小写
            const result = await prisma.vocab.updateMany({
                where: {
                    partOfSpeech: {
                        equals: raw,
                        mode: 'insensitive' // 处理大小写不一致
                    },
                    NOT: {
                        partOfSpeech: normalized // 排除已经完全匹配的
                    }
                },
                data: {
                    partOfSpeech: normalized
                }
            });
            if (result.count > 0) {
                console.log(`归一化 [${raw}] (大小写修正) -> [${normalized}]: ${result.count} 条记录`);
                totalUpdated += result.count;
            }
            continue;
        }

        const result = await prisma.vocab.updateMany({
            where: {
                partOfSpeech: {
                    equals: raw,
                    mode: 'insensitive'
                }
            },
            data: {
                partOfSpeech: normalized
            }
        });

        if (result.count > 0) {
            console.log(`归一化 [${raw}] -> [${normalized}]: ${result.count} 条记录`);
            totalUpdated += result.count;
        }
    }

    console.log(`\n修复完成！共更新 ${totalUpdated} 条记录。`);

    // 再次运行统计
    console.log('\n运行最新统计...');
}

main()
    .catch(err => {
        console.error('修复失败:', err);
    })
    .finally(() => prisma.$disconnect());
