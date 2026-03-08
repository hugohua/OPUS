'use client';

import NextImage from 'next/image';

import {
    LayoutDashboard,
    ListOrdered,
    Settings,
    ShieldAlert,
    Menu,
    DatabaseZap
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
import { AudioCacheCleanupButton } from '@/app/admin/_components/audio-cache-cleanup-button';

export function GlobalAdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const navItems = [
        {
            path: '/admin/inspector',
            label: '神之眼',
            icon: <ShieldAlert className="w-5 h-5" />
        },
        {
            path: '/admin/queue',
            label: '队列管理',
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
                        <div className="w-8 h-8 relative shrink-0">
                            <NextImage
                                src="/favicon.svg"
                                alt="OPUS Logo"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="ml-3 font-mono font-bold text-sm tracking-wider text-zinc-800 dark:text-zinc-200 transition-opacity duration-300 opacity-0 group-data-[state=expanded]:opacity-100">
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
                        <div className="w-full flex flex-col gap-4">
                            <AudioCacheCleanupButton />
                            <StatusIndicator />
                        </div>
                    </SidebarFooter>
                </AdminSidebar>
            </div>

            {/* Mobile Header (Visible on Mobile) */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-lg border-b border-border z-50 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 relative shrink-0">
                        <NextImage
                            src="/favicon.svg"
                            alt="OPUS Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="font-mono font-bold text-sm text-foreground">OPUS 后台</span>
                </div>

                <Drawer>
                    <DrawerTrigger asChild>
                        <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
                            <Menu className="w-6 h-6" />
                        </button>
                    </DrawerTrigger>
                    <DrawerContent className="bg-background border-border text-foreground">
                        <DrawerHeader>
                            <DrawerTitle className="text-foreground">导航</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4 space-y-2">
                            {navItems.map(item => (
                                <button
                                    key={item.path}
                                    onClick={() => router.push(item.path)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                                        pathname?.startsWith(item.path)
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "bg-muted/50 text-muted-foreground active:bg-muted border border-border"
                                    )}
                                >
                                    {item.icon}
                                    <span className="font-bold">{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-t border-border space-y-4">
                            <AudioCacheCleanupButton />
                            <StatusIndicator mobile />
                        </div>
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
