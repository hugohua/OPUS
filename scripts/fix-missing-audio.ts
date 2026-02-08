/**
 * 手动触发音频生成脚本
 */
import { prisma } from '../lib/db';
import { getTTSAudioCore } from '../lib/tts/service';

async function fixMissingAudio() {
    console.log('\n🔧 修复缺失的 Context 音频...\n');

    // 查找所有没有 ttsHash 的 SmartContent
    // [Fix] 优先修复 compile (id=1005)
    const missing = await prisma.smartContent.findMany({
        where: {
            // ttsHash: null, // Comment out to force check/regenerate (though logic below assumes null)
            vocabId: 1005, // 优先修复 compile
            type: 'L2_SENTENCE'
        },
        take: 20
    });

    console.log(`📊 找到 ${missing.length} 条缺失音频的记录\n`);

    for (const content of missing) {
        const payload = content.payload as any;
        const text = payload.text;

        console.log(`---`);
        console.log(`处理: ${content.id}`);
        console.log(`场景: ${content.scenario}`);
        console.log(`文本: ${text?.substring(0, 50)}...`);

        try {
            // 生成音频
            const result = await getTTSAudioCore({
                text,
                voice: 'Cherry',
                language: 'en-US',
                speed: 1.0,
                cacheType: 'temporary',
            });

            // 回填 ttsHash
            await prisma.smartContent.update({
                where: { id: content.id },
                data: { ttsHash: result.hash },
            });

            console.log(`✅ 音频已生成: ${result.url} (cached: ${result.cached})`);

        } catch (error: any) {
            console.error(`❌ 音频生成失败: ${error.message}`);
        }
    }

    console.log(`\n✨ 完成！\n`);
    await prisma.$disconnect();
}

fixMissingAudio().catch(console.error);
