"use client";

import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { format } from "date-fns";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardHeader() {
    const [date, setDate] = useState<Date | null>(null);

    useEffect(() => {
        setDate(new Date());
    }, []);

    return (
        <header className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4">
            {/* Left: Welcome & Slogan */}
            <div>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Welcome back, <span className="text-violet-600 dark:text-violet-400">Hugo</span>
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">Let's keep the momentum.</p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <ThemeToggle className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" />

                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-full shadow-sm">
                    <span className="text-orange-500 text-sm">🔥</span>
                    <span className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">12</span>
                </div>
            </div>
        </header>
    );
}
