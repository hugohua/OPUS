'use client';

import {
    LayoutDashboard,
    ListOrdered,
    Settings,
    ShieldAlert
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
    AdminSidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarItem
} from '@/components/admin/sidebar';

export function GlobalAdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <AdminSidebar>
            {/* Brand Header */}
            <SidebarHeader>
                <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(124,58,237,0.5)] shrink-0">
                    OP
                </div>
                <span className="ml-3 font-mono font-bold text-sm tracking-wider text-zinc-200 transition-opacity duration-300 opacity-0 group-data-[state=expanded]:opacity-100">
                    OPUS 后台
                </span>
            </SidebarHeader>

            {/* Navigation */}
            <SidebarContent>
                <SidebarItem
                    active={pathname?.startsWith('/admin/inspector')}
                    onClick={() => router.push('/admin/inspector')}
                    icon={<ShieldAlert className="w-5 h-5" />}
                    label="神之眼 (Inspector)"
                />

                <SidebarItem
                    active={pathname?.startsWith('/admin/queue')}
                    onClick={() => router.push('/admin/queue')}
                    icon={<ListOrdered className="w-5 h-5" />}
                    label="队列管理 (Queue)"
                />
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter>
                <div className="flex items-center gap-2 mb-2 justify-center transition-all">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                    <span className="text-[10px] font-mono text-emerald-500 hidden group-data-[state=expanded]:block whitespace-nowrap">系统正常</span>
                </div>
            </SidebarFooter>
        </AdminSidebar>
    );
}
