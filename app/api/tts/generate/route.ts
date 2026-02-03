/**
 * TTS Generate API Route
 * 
 * 桥接核心服务，确保 Next.js 作为主脑处理所有 DB 读写
 * 前端调用: POST /api/tts/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTTSAudioCore } from '@/lib/tts/service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // [Validation] 防止无效请求导致 Python 服务挂起
        if (!body.text || typeof body.text !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Missing required field: text' },
                { status: 400 }
            );
        }

        // 调用 Server Action (处理 DB 缓存 + Python TTS 生成)
        const result = await getTTSAudioCore({
            text: body.text,
            voice: body.voice,
            language: body.language,
            speed: body.speed,
            cacheType: body.cacheType,
        });

        return NextResponse.json({
            success: true,
            url: result.url,
            cached: result.cached,
            hash: result.hash,
        });

    } catch (error: any) {
        console.error('[TTS API Route] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
