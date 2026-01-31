import { NextResponse } from 'next/server';
import Redis from 'ioredis';

// GET /api/admin/history
// Fetch recent drill generations from Redis List
export async function GET() {
    try {
        const redis = new Redis(process.env.REDIS_URL!);

        // Fetch last 50 items
        const rawItems = await redis.lrange('admin:drill-history', 0, 49);

        // Parse JSON
        const items = rawItems.map(item => {
            try {
                return JSON.parse(item);
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        redis.quit();

        return NextResponse.json({ success: true, items });
    } catch (error) {
        console.error('Failed to fetch history:', error);
        return NextResponse.json({ success: false, items: [] }, { status: 500 });
    }
}

// DELETE /api/admin/history
// Clear history buffer
export async function DELETE() {
    try {
        const redis = new Redis(process.env.REDIS_URL!);
        await redis.del('admin:drill-history');
        redis.quit();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
