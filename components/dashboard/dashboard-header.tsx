"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileButton } from "@/components/dashboard/user-profile-button";
import { User } from "next-auth";
import { GlobalHeader } from "@/components/ui/global-header";

interface DashboardHeaderProps {
    user?: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const displayName = user?.name || "Guest";

    const titleContent = (
        <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                欢迎回来，<span className="text-violet-600 dark:text-violet-400">{displayName}</span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5 font-normal">继续保持进步。</p>
        </div>
    );

    const rightActions = (
        <>
            <ThemeToggle className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" />

            {/* Changed from streak (🔥) to safe survival metric, ensuring Anti-Spec compliance */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-zinc-300">
                <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="font-mono text-xs font-bold">12</span>
            </div>

            <UserProfileButton user={user} />
        </>
    );

    return (
        <GlobalHeader
            title={titleContent}
            rightSlot={rightActions}
        />
    );
}
