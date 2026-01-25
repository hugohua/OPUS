"use client";

import { Sparkles, LayoutGrid, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function FloatingDock() {
    return (
        <div className="fixed bottom-0 left-0 w-full z-50">
            {/* Gradient Fade to Blend with Content */}
            <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 dark:to-transparent"></div>

            <nav className="relative mb-8 mx-auto w-[92%] max-w-md">
                <div className="relative flex h-20 w-full items-center justify-between rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-10 backdrop-blur-2xl shadow-2xl shadow-zinc-900/10 dark:shadow-black/50">

                    {/* Left: Tools/Home */}
                    <Link href="/dashboard" className="flex flex-col items-center gap-1 text-zinc-900 dark:text-white active:scale-95 transition-transform group">
                        <div className="p-1 rounded-xl group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
                            <LayoutGrid className="w-6 h-6 stroke-[1.5px]" />
                        </div>
                        <span className="text-[10px] font-medium opacity-80">Tools</span>
                    </Link>

                    {/* Center: Magic Action (Drill/Scan) */}
                    <Link href="/dashboard/scan" className="group absolute -top-6 left-1/2 -translate-x-1/2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-600/30 border-[4px] border-zinc-50 dark:border-zinc-950 active:scale-95 active:rotate-12 transition-all duration-300">
                        <Sparkles className="w-7 h-7 text-white stroke-2" />
                    </Link>

                    {/* Right: Stats/Profile */}
                    <Link href="/dashboard/profile" className="flex flex-col items-center gap-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 active:scale-95 transition-transform group">
                        <div className="p-1 rounded-xl group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors">
                            <User className="w-6 h-6 stroke-[1.5px]" />
                        </div>
                        <span className="text-[10px] font-medium opacity-80">Stats</span>
                    </Link>

                </div>
            </nav>
        </div>
    );
}
