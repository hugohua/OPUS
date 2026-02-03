
/**
 * Seed L1 Test Data
 * 
 * 功能：
 *   为测试单词填充 confusionAudio 字段。
 * 
 * 使用方法：
 *   npx tsx scripts/seed-l1-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 开始填充 L1 测试数据...');

    const updates = [
        {
            word: 'abroad',
            confusion_audio: ['aboard', 'abode', 'broad']
        },
        {
            word: 'accept',
            confusion_audio: ['except', 'access', 'expect']
        },
        {
            word: 'affect',
            confusion_audio: ['effect', 'effort', 'afford']
        }
    ];

    for (const item of updates) {
        // 先检查单词是否存在
        const vocab = await prisma.vocab.findUnique({
            where: { word: item.word }
        });

        if (!vocab) {
            console.log(`⚠️ 单词不存在: ${item.word}，尝试创建...`);
            try {
                await prisma.vocab.create({
                    data: {
                        word: item.word,
                        definition_cn: "测试定义",
                        confusion_audio: item.confusion_audio,
                        is_toeic_core: true
                    }
                });
                console.log(`✅ 已创建并填充: ${item.word}`);
            } catch (e) {
                console.error(`❌ 创建失败 ${item.word}:`, e);
            }
        } else {
            await prisma.vocab.update({
                where: { word: item.word },
                data: {
                    confusion_audio: item.confusion_audio
                }
            });
            console.log(`✅ 已更新: ${item.word} -> ${JSON.stringify(item.confusion_audio)}`);
        }
    }

    console.log('🎉 测试数据填充完成！');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
