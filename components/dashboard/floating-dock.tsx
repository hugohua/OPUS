'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Layers, ShieldCheck, SlidersHorizontal, BookOpen } from "lucide-react"; // Using Lucide approximations for provided SVGs

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
            href: "/dashboard",
            icon: Home,
            label: "Dashboard",
            exact: true
        },
        {
            href: "/vocabulary",
            icon: Layers, // Visual approximation to the "Stack/List" icon in demo, or sticking to BookOpen? 
            // Demo 2nd icon looks like a List. Let's use Layers or BookCopy. 
            // Previous was BookOpen. Let's stick to semantic meaning: Inventory => Layers/Database.
            // But user said "Inventory (Word List)". 
            // Let's use Layers as it looks like a stack of cards.
            label: "Inventory",
            hasDot: hasDue
        },
        {
            href: "/admin", // User requested Admin
            icon: ShieldCheck, // Shield icon
            label: "Admin"
        },
        {
            href: "/dashboard/profile", // User requested Profile
            icon: SlidersHorizontal, // Sliders icon
            label: "Profile"
        }
    ];

    return (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-full shadow-2xl flex items-center justify-around px-2 z-50">
            {navItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 relative",
                            active
                                ? "text-indigo-500 bg-indigo-500/10"
                                : "text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                        )}
                    >
                        <Icon className="w-6 h-6 stroke-[1.5px]" />

                        {/* Red Dot for Due Items */}
                        {item.hasDot && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-zinc-900 shadow-sm animate-pulse-slow"></span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
