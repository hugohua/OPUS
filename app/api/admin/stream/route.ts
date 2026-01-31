import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// SSE Route: GET /api/admin/stream
export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    // Create a dedicated Redis connection for subscription
    // We cannot reuse the shared connection because subscription blocks it
    const redisSubscriber = new Redis(process.env.REDIS_URL!);

    const stream = new ReadableStream({
        async start(controller) {
            // Subscribe to the channel
            await redisSubscriber.subscribe('admin:drill-stream');

            // Safe enqueue helper to ignore errors when stream is closed
            const safeEnqueue = (data: Uint8Array) => {
                try {
                    controller.enqueue(data);
                } catch (e) {
                    // Start of 'failed to pipe response' error usually means stream closed
                    // We can just ignore it as cleanup will happen via signal.abort
                }
            };

            // Handle incoming messages
            redisSubscriber.on('message', (channel, message) => {
                if (channel === 'admin:drill-stream') {
                    // SSE format: data: <content>\n\n
                    const event = `data: ${message}\n\n`;
                    safeEnqueue(encoder.encode(event));
                }
            });

            // Keep connection alive notification (optional heartbreat)
            const heartbeat = setInterval(() => {
                safeEnqueue(encoder.encode(': heartbeat\n\n'));
            }, 30000);

            // Cleanup logic when stream closes (not fully reliable in all environments but good to have)
            req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                redisSubscriber.quit();
            });
        },
        async cancel() {
            await redisSubscriber.quit();
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Encoding': 'none',
        },
    });
}
