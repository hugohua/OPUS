'use client';

import Link from "next/link";

interface FsrsHudProps {
    stats: {
        mastered: number;
        learning: number;
        due: number; // or total? Usually total for progress bar denominator? 
    };
    retentionRate?: number; // Optional prop for the top right
}

export function FsrsHud({ stats, retentionRate = 94 }: FsrsHudProps) {
    const total = stats.mastered + stats.learning + stats.due || 1; // Avoid divide by zero

    // Calculate widths (floored to avoid overflow, or use flex-grow)
    // Using flex basis/grow is safer for responsiveness, but style={width%} matches user request
    const pStable = Math.max(2, (stats.mastered / total) * 100);
    const pLearning = Math.max(2, (stats.learning / total) * 100);
    const pDue = Math.max(2, (stats.due / total) * 100);

    // Normalize to 100% (optional, css flex handles this better but let's stick to width style for animation control)
    // Actually, user example used fixed widths. Flex is better.
    // Let's use flex-grow with minimum widths.

    return (
        <section className="px-6 mt-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">

                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        {/* Lucide: Activity */}
                        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">记忆遥测</span>
                    </div>
                    {/* Retention Badge */}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                        <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        <span className="text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400">{retentionRate}% R</span>
                    </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full flex overflow-hidden mb-3">
                    {/* Stable */}
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pStable}%` }}></div>
                    <div className="h-full w-[1px] bg-white dark:bg-zinc-900"></div>

                    {/* Learning */}
                    <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${pLearning}%` }}></div>
                    <div className="h-full w-[1px] bg-white dark:bg-zinc-900"></div>

                    {/* Due */}
                    <div className="h-full bg-rose-500 transition-all duration-1000 animate-pulse" style={{ width: `${pDue}%` }}></div>
                </div>

                {/* Legend / Stats Row */}
                <div className="flex items-center justify-between text-[10px] font-mono">

                    <Link href="/vocabulary?status=MASTERED" className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 active:scale-95 transition-transform" title="长期记忆">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-zinc-400">已掌握</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold">{stats.mastered}</span>
                    </Link>

                    <Link href="/vocabulary?status=LEARNING" className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 active:scale-95 transition-transform" title="正在习得">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                        <span className="text-zinc-400">学习中</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold">{stats.learning}</span>
                    </Link>

                    <Link href="/vocabulary?status=REVIEW" className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 active:scale-95 transition-transform" title="需要复习">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                        <span className="text-zinc-400">待复习</span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{stats.due}</span>
                    </Link>

                </div>

            </div>
        </section>
    );
}
