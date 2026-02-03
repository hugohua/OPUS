/**
 * TTS Service Core Logic
 * 
 * 提取自 tts-actions.ts，供 Server Action 和 Route Handler 共用
 * 职责: DB 缓存查询 + Python TTS 调用 + DB 写入
 */

import { prisma } from '@/lib/db';
import { generateAudioHash } from '@/lib/tts/hash';

// Python TTS 服务地址
const PYTHON_TTS_URL = process.env.PYTHON_TTS_URL || 'http://127.0.0.1:8000';

export interface TTSOptions {
    text: string;
    voice?: string;
    language?: string;
    speed?: number;
    cacheType?: 'vocab' | 'phrase' | 'temporary';
}

export interface TTSResult {
    url: string;
    cached: boolean;
    hash: string;
}

/**
 * 获取 TTS 音频 URL
 * 
 * 流程:
 * 1. 计算 Hash
 * 2. 查 DB (极速)
 * 3. 命中 → 更新 lastUsedAt → 返回 URL
 * 4. 未命中 → 调用 Python → 写 DB → 返回 URL
 */
export async function getTTSAudioCore(options: TTSOptions): Promise<TTSResult> {
    const {
        text,
        voice = 'Cherry',
        language = 'en-US',
        speed = 1.0,
        cacheType = 'temporary',
    } = options;

    // 1. 计算 Hash
    const hash = generateAudioHash({ text, voice, language, speed });

    // 2. 查 DB (极速，不触碰文件系统 IO)
    const cache = await prisma.tTSCache.findUnique({
        where: { id: hash },
    });

    if (cache) {
        // 命中缓存，更新 lastUsedAt (异步，不阻塞返回)
        prisma.tTSCache.update({
            where: { id: hash },
            data: { lastUsedAt: new Date() },
        }).catch(() => { }); // 忽略更新失败

        return {
            url: cache.url,
            cached: true,
            hash,
        };
    }

    // 3. 未命中 → 调用 Python 服务
    const pyResponse = await fetch(`${PYTHON_TTS_URL}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, language, speed }),
    });

    if (!pyResponse.ok) {
        const errorText = await pyResponse.text();
        console.error(`TTS Service Error: Status ${pyResponse.status}, Body: ${errorText}`);
        throw new Error(`TTS 生成失败: ${errorText}`);
    }

    const pyResult = await pyResponse.json();

    // Python 返回: { success, url, hash, file_size }
    const { url, file_size: fileSize } = pyResult;

    // 4. 写 DB (使用 upsert 处理并发)
    try {
        await prisma.tTSCache.upsert({
            where: { id: hash },
            create: {
                id: hash,
                text,
                voice,
                language,
                speed,
                cacheType,
                filePath: url,  // Python 返回的相对路径
                url,
                fileSize: fileSize || 0,
            },
            update: {
                lastUsedAt: new Date(),
            },
        });
    } catch (e: any) {
        // P2002: Unique constraint failed (并发写入)
        // 直接忽略，因为文件已经存在了
        if (e.code !== 'P2002') {
            console.error('TTSCache 写入失败:', e);
        }
    }

    return {
        url,
        cached: false,
        hash,
    };
}

/**
 * 检查 TTS 缓存是否存在
 */
export async function checkTTSCacheCore(hash: string): Promise<boolean> {
    const cache = await prisma.tTSCache.findUnique({
        where: { id: hash },
        select: { id: true },
    });
    return !!cache;
}

/**
 * 清理过期的临时缓存
 */
export async function cleanupTemporaryCacheCore(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.tTSCache.deleteMany({
        where: {
            cacheType: 'temporary',
            lastUsedAt: { lt: cutoffDate },
        },
    });

    return result.count;
}
