import { NextResponse } from 'next/server';
import { redis } from '@/lib/queue/connection';
import { auth } from '@/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:history');

// GET /api/admin/history
// Fetch recent drill generations from Redis List
export async function GET() {
    try {
        // [Security Fix] Auth 校验
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        return NextResponse.json({ success: true, items });
    } catch (error) {
        log.error({ error }, 'Failed to fetch history');
        return NextResponse.json({ success: false, items: [] }, { status: 500 });
    }
}

// DELETE /api/admin/history
// Clear history buffer
export async function DELETE() {
    try {
        // [Security Fix] Auth 校验
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await redis.del('admin:drill-history');
        return NextResponse.json({ success: true });
    } catch (error) {
        log.error({ error }, 'Failed to clear history');
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
