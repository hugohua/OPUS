'use client';

import {
    LayoutDashboard,
    ListOrdered,
    Settings,
    ShieldAlert,
    Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
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

    const navItems = [
        {
            path: '/admin/inspector',
            label: '神之眼 (Inspector)',
            icon: <ShieldAlert className="w-5 h-5" />
        },
        {
            path: '/admin/queue',
            label: '队列管理 (Queue)',
            icon: <ListOrdered className="w-5 h-5" />
        }
    ];

    return (
        <>
            {/* Desktop Sidebar (Hidden on Mobile) */}
            <div className="hidden md:flex h-screen sticky top-0">
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
                        {navItems.map(item => (
                            <SidebarItem
                                key={item.path}
                                active={pathname?.startsWith(item.path)}
                                onClick={() => router.push(item.path)}
                                icon={item.icon}
                                label={item.label}
                            />
                        ))}
                    </SidebarContent>

                    {/* Footer */}
                    <SidebarFooter>
                        <StatusIndicator />
                    </SidebarFooter>
                </AdminSidebar>
            </div>

            {/* Mobile Header (Visible on Mobile) */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900/80 backdrop-blur-lg border-b border-white/5 z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center font-bold text-[10px] text-white">
                        OP
                    </div>
                    <span className="font-mono font-bold text-sm text-zinc-200">OPUS Admin</span>
                </div>

                <Drawer>
                    <DrawerTrigger asChild>
                        <button className="p-2 -mr-2 text-zinc-400 hover:text-white">
                            <Menu className="w-6 h-6" />
                        </button>
                    </DrawerTrigger>
                    <DrawerContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <DrawerHeader>
                            <DrawerTitle className="text-zinc-100">管理后台导航</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 space-y-2">
                            {navItems.map(item => (
                                <button
                                    key={item.path}
                                    onClick={() => router.push(item.path)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                                        pathname?.startsWith(item.path)
                                            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                                            : "bg-zinc-800/50 text-zinc-400 active:bg-zinc-800 border border-white/5"
                                    )}
                                >
                                    {item.icon}
                                    <span className="font-bold">{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <DrawerFooter className="border-t border-white/5 pt-4 mt-2">
                            <StatusIndicator mobile />
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </div>
        </>
    );
}

function StatusIndicator({ mobile }: { mobile?: boolean }) {
    return (
        <div className={cn("flex items-center gap-2 justify-center transition-all", mobile ? "w-full py-2" : "mb-2")}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
            <span className={cn(
                "text-[10px] font-mono text-emerald-500 whitespace-nowrap",
                !mobile && "hidden group-data-[state=expanded]:block"
            )}>
                系统正常
            </span>
        </div>
    );
}
