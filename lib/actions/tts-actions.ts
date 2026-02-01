'use server';

/**
 * TTS Server Actions
 * 
 * Next.js 主脑层 - 负责所有 DB 读写和调用 Python TTS 服务
 * Python 只负责生成文件，不接触数据库
 * 
 * 核心逻辑委托给 lib/tts/service.ts
 */

import {
    getTTSAudioCore,
    checkTTSCacheCore,
    cleanupTemporaryCacheCore,
    type TTSOptions,
    type TTSResult,
} from '@/lib/tts/service';

export type { TTSOptions, TTSResult };

/**
 * 获取 TTS 音频 URL (Server Action 包装器)
 */
export async function getTTSAudio(options: TTSOptions): Promise<TTSResult> {
    return getTTSAudioCore(options);
}

/**
 * 检查 TTS 缓存是否存在
 */
export async function checkTTSCache(hash: string): Promise<boolean> {
    return checkTTSCacheCore(hash);
}

/**
 * 清理过期的临时缓存
 */
export async function cleanupTemporaryCache(daysOld: number = 90): Promise<number> {
    return cleanupTemporaryCacheCore(daysOld);
}
