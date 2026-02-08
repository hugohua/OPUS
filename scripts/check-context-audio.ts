/**
 * 诊断脚本：检查 SmartContent 音频生成状态
 */
import { prisma } from '../lib/db';

async function checkContextAudio() {
    const word = 'compile';

    console.log(`\n🔍 检查单词 "${word}" 的 Context 音频状态...\n`);

    // 1. 获取 vocabId
    const vocab = await prisma.vocab.findUnique({
        where: { word },
        select: { id: true, word: true }
    });

    if (!vocab) {
        console.log(`❌ 单词 "${word}" 不存在于数据库`);
        return;
    }

    console.log(`✅ Vocab ID: ${vocab.id}`);

    // 2. 查询所有 SmartContent 记录
    const contents = await prisma.smartContent.findMany({
        where: { vocabId: vocab.id },
        include: { ttsCache: true },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📊 找到 ${contents.length} 条 SmartContent 记录:\n`);

    for (const content of contents) {
        const payload = content.payload as any;
        console.log(`---`);
        console.log(`ID: ${content.id}`);
        console.log(`Scenario: ${content.scenario}`);
        console.log(`Text: ${payload.text?.substring(0, 60)}...`);
        console.log(`ttsHash: ${content.ttsHash || '❌ NULL'}`);
        console.log(`Audio URL: ${content.ttsCache?.url || '❌ 未生成'}`);
        console.log(`Created: ${content.createdAt}`);

        // 如果有 ttsHash 但没有 ttsCache，说明关联断了
        if (content.ttsHash && !content.ttsCache) {
            console.log(`⚠️  警告：ttsHash 存在但 ttsCache 关联失败！`);
            // 尝试单独查询 TTSCache
            const cache = await prisma.tTSCache.findUnique({
                where: { id: content.ttsHash }
            });
            if (cache) {
                console.log(`   TTSCache 记录存在: ${cache.url}`);
            } else {
                console.log(`   TTSCache 记录不存在（孤儿 hash）`);
            }
        }
    }

    // 3. 检查最近的 TTS 生成记录
    console.log(`\n🎵 最近的 TTS 缓存记录 (包含 "compile"):\n`);
    const recentTTS = await prisma.tTSCache.findMany({
        where: {
            text: { contains: 'compile', mode: 'insensitive' }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    for (const tts of recentTTS) {
        console.log(`---`);
        console.log(`Hash: ${tts.id}`);
        console.log(`Text: ${tts.text.substring(0, 60)}...`);
        console.log(`URL: ${tts.url}`);
        console.log(`Created: ${tts.createdAt}`);
    }

    await prisma.$disconnect();
}

checkContextAudio().catch(console.error);
