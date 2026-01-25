import { NextRequest, NextResponse } from 'next/server';
import { flushUserSession } from '@/lib/session-manager';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:session:flush');

export async function POST(req: NextRequest) {
    try {
        // Beacon API 发送的是 Blob/Text, 需要用 text() 解析
        const text = await req.text();
        const { userId } = JSON.parse(text);

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // 使用 waitUntil (Vercel/Next.js) 确保请求结束后继续执行
        // 如果环境不支持 waitUntil，await 也会阻塞直到完成
        const promise = flushUserSession(userId).catch(err => {
            log.error({ error: err, userId }, 'Flush failed');
        });

        if ((req as any).waitUntil) {
            (req as any).waitUntil(promise);
        } else {
            await promise;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        log.error({ error }, 'API Error');
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
