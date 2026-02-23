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
