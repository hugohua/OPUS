"use client";

import { Play, ChevronRight } from "lucide-react";
import Link from "next/link";

export function DailyBlitzCard() {
    return (
        <section>
            <Link href="/dashboard/session/DAILY_BLITZ">
                <div className="w-full group relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900/60 dark:backdrop-blur-xl border border-zinc-200 dark:border-white/15 py-4 transition-all active:scale-[0.99] hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <div className="relative z-10 flex items-center justify-between px-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-violet-100 dark:bg-violet-500/20 rounded-full">
                                <Play className="w-5 h-5 text-violet-600 dark:text-violet-400 fill-current" />
                            </div>
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                    每日闪电战
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                                    20 词 • 混合模式
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/10 text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono ring-1 ring-inset ring-amber-500/20">
                                待复习
                            </span>
                            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        </div>
                    </div>
                </div>
            </Link>
        </section>
    );
}
