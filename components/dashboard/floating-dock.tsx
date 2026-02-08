'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Layers, ShieldCheck, User, Zap } from "lucide-react";

interface FloatingDockProps {
    hasDue?: boolean;
}

export function FloatingDock({ hasDue = false }: FloatingDockProps) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname?.startsWith(path)) return true;
        return false;
    };

    const navItems = [
        {
            href: "/dashboard/simulate",
            icon: Zap,
            label: "模拟",
            exact: false
        },
        {
            href: "/vocabulary",
            icon: Layers,
            label: "词库",
            hasDot: hasDue
        },
        {
            href: "/admin",
            icon: ShieldCheck,
            label: "后台"
        },
        {
            href: "/dashboard/profile",
            icon: User,
            label: "我的"
        }
    ];

    return (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] h-16 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 flex items-center justify-around px-2 z-50">
            {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center w-16 h-full transition-all duration-300 relative group",
                            active
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        <div className={cn(
                            "p-1.5 rounded-xl transition-all duration-300 mb-0.5",
                            active ? "bg-indigo-50 dark:bg-indigo-500/10 scale-110" : "group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800"
                        )}>
                            <Icon className={cn("w-5 h-5 stroke-[2px]", active && "fill-indigo-500/20")} />
                        </div>
                        <span className="text-[10px] font-medium scale-90 origin-top">{item.label}</span>

                        {/* Red Dot for Due Items */}
                        {item.hasDot && (
                            <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse"></span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
