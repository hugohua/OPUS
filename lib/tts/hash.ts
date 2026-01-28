/**
 * 音频 Hash 生成工具
 * 
 * ⚠️ CRITICAL: 必须与 Python 后端 (core/hash.py) 算法完全一致
 * Algorithm: MD5(`${text}_${voice}_${language}_${speed}`)
 */
import MD5 from 'crypto-js/md5';

interface HashOptions {
    text: string;
    voice?: string;
    language?: string;
    speed?: number;
}

export function generateAudioHash({
    text,
    voice = 'Cherry',
    language = 'en-US',
    speed = 1.0,
}: HashOptions): string {
    // 按照特定顺序拼接: text_voice_language_speed
    // 注意：Python 侧默认值必须与此处一致
    const hashInput = `${text}_${voice}_${language}_${speed.toFixed(1)}`;

    return MD5(hashInput).toString();
}
