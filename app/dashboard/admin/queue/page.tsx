/**
 * 队列管理 Dashboard 页面
 */
import { Suspense } from 'react';
import { getQueueStatus, getCacheStats } from '@/actions/queue-admin';
import { QueueStatusCard } from '@/components/admin/queue-status-card';
import { CacheStatsCard } from '@/components/admin/cache-stats-card';
import { OperationPanel } from '@/components/admin/operation-panel';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

import { Header } from '@/components/ui/header';

export const dynamic = 'force-dynamic';

export default async function QueueDashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const [status, cacheStats] = await Promise.all([
        getQueueStatus(),
        getCacheStats(),
    ]);

    const SystemStatusBadge = (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
        </div>
    );

    return (
        <div className="dark min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans antialiased relative overflow-hidden">
            {/* Background Glow Removed */}

            {/* Smart Frame Header */}
            <Header
                variant="default"
                title="队列控制台"
                rightAction={SystemStatusBadge}
            />

            {/* Main Content (with padding) */}
            <div className="relative z-10 p-6 md:p-10 space-y-6">

                {/* 1. Real-time Metrics (Full Width) */}
                <Suspense fallback={<CardSkeleton />}>
                    <QueueStatusCard status={status} />
                </Suspense>

                {/* 2. Cache Inventory (2 Cols) */}
                <Suspense fallback={<CardSkeleton />}>
                    <CacheStatsCard stats={cacheStats} />
                </Suspense>

                {/* 3. Manual Triggers (1 Col) */}
                <Suspense fallback={<CardSkeleton />}>
                    <OperationPanel isPaused={status.isPaused} userId={session.user.id} />
                </Suspense>
            </div>
        </div>
    );
}

function CardSkeleton() {
    return (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-xl animate-pulse min-h-[200px]" />
    );
}
