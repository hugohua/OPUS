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
            {/* Brand Identity */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Opus.</h1>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wide mt-1 uppercase min-h-[1.5em]">
                    {date ? format(date, "EEE, MMM d") : <span className="opacity-0">Loading...</span>}
                </p>
            </div>

            {/* Right Actions */}
            <div className="flex gap-3">
                <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-foreground active:scale-95 transition-transform" />

                {/* Commute Mode Action */}
                <button className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm active:scale-95 transition-all">
                    <span className="absolute inset-0 rounded-full border border-violet-500/30 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity" />
                    <Waves className="w-5 h-5 text-violet-600 dark:text-violet-400 stroke-[1.5px]" />
                </button>
            </div>
        </header>
    );
}
