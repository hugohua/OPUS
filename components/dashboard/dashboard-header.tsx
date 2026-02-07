"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileButton } from "@/components/dashboard/user-profile-button";
import { User } from "next-auth";

interface DashboardHeaderProps {
    user?: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch for client-only things if needed, 
    // but name/user data comes from server so it's fine.

    const displayName = user?.name || "Guest";

    return (
        <header className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4">
            {/* Left: Welcome & Slogan */}
            <div>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    欢迎回来，<span className="text-violet-600 dark:text-violet-400">{displayName}</span>
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">继续保持进步。</p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <ThemeToggle className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" />

                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-full shadow-sm mr-2">
                    <span className="text-orange-500 text-sm">🔥</span>
                    <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">12</span>
                </div>

                <UserProfileButton user={user} />
            </div>
        </header>
    );
}
