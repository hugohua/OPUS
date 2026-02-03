
import 'dotenv/config';
import { getTTSAudioCore } from '@/lib/tts/service';
import { logger } from '@/lib/logger';

async function main() {
    const text = "Testing TTS Integration Phase 3";
    logger.info({ text }, 'Starting TTS Test');

    try {
        const result = await getTTSAudioCore({
            text,
            voice: 'Cherry',
            language: 'en-US',
            speed: 1.0,
            cacheType: 'temporary'
        });

        logger.info({ result }, '✅ TTS Generated Successfully');
        console.log('TTS Result:', JSON.stringify(result, null, 2));

        if (!result.url) {
            throw new Error('No URL returned');
        }

    } catch (error) {
        console.error('详细错误:', error);
        logger.error({ error: String(error) }, '❌ TTS Test Failed');
        process.exit(1);
    }
}

main();
