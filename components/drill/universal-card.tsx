"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { X, ChevronLeft } from "lucide-react";

interface UniversalCardProps {
    variant?: "violet" | "emerald" | "amber" | "rose" | "blue" | "pink";
    category?: string;
    progress?: number;
    children: React.ReactNode;
    footer: React.ReactNode;
    className?: string;
    onExit?: () => void;
}

export function UniversalCard({
    variant = "violet",
    category,
    progress = 0,
    children,
    footer,
    className,
    onExit
}: UniversalCardProps) {

    // Map variant to colors
    const colorMap = {
        violet: "bg-violet-500",
        emerald: "bg-emerald-500",
        amber: "bg-amber-500",
        rose: "bg-rose-500",
        blue: "bg-blue-500",
        pink: "bg-pink-500",
    };

    const accentBg = colorMap[variant] || colorMap.violet;

    return (
        <div className={cn(
            "relative h-[100dvh] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased flex flex-col transition-colors duration-300",
            className
        )}>

            {/* 1. HEADER (Fixed Top) */}
            <header className="relative z-20 flex items-center justify-between px-6 h-20 shrink-0">

                {/* Progress Bar */}
                <div className="flex-1 max-w-[120px]">
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all duration-500 ease-out", accentBg)}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>

                <div className="flex-1"></div>

                {/* Exit Button */}
                <button
                    onClick={onExit}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 -mr-2"
                >
                    <X className="w-6 h-6" strokeWidth={2} />
                </button>
            </header>

            {/* 2. MAIN Content (Stimulus Card) */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 w-full overflow-y-auto no-scrollbar pb-6">

                <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none p-8 flex flex-col items-center min-h-[300px] justify-center relative overflow-hidden">

                    {/* Category Tag */}
                    {category && (
                        <div className="mb-8 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                            {category}
                        </div>
                    )}

                    {/* Children (Question content) */}
                    <div className="w-full flex-1 flex flex-col items-center justify-center">
                        {children}
                    </div>

                </div>

            </main>

            {/* 3. FOOTER (Interaction Zone) */}
            <footer className="relative z-20 w-full shrink-0 pb-safe pt-4">
                <div className="px-6 pb-24 w-full max-w-lg mx-auto">
                    {footer}
                </div>
            </footer>

        </div>
    );
}
