/**
 * Dashboard Layout
 * 功能：
 *   提供移动端优先的容器布局
 *   静默触发 Drill 缓存预取
 */
import { PrefetchTrigger } from '@/components/session/prefetch-trigger';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-background font-sans flex justify-center selection:bg-primary/20">
            {/* ⚡️ 静默预取触发器 - 用户浏览任何 Dashboard 页面时预热缓存 */}
            <PrefetchTrigger />

            {/* Mobile First Container - "The Device" */}
            <div className="w-full max-w-md bg-background min-h-screen shadow-2xl ring-1 ring-border/5 relative flex flex-col">

                {/* Main Workspace */}
                <main className="flex-1 w-full relative z-0">
                    {children}
                </main>

            </div>
        </div>
    );
}
