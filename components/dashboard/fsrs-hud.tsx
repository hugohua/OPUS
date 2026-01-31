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
    // Calculate widths for visual bars (approximate or exact if total known)
    // For visual aesthetic, we map raw numbers to reasonable bar widths if ratio is undefined.
    // Or we assume a "Capacity" (e.g. 3000 words).
    // Let's use a dynamic scale: Max(100%, count / 1000 * 100).
    // Actually, demo shows percentage bars relative to "full width" of the small container.
    // Let's assume the bars represent a "Goal" (e.g. 2000 words).
    const goal = 2000;

    // Helper for width style
    const getWidth = (val: number) => {
        const pct = Math.min(100, Math.max(5, (val / goal) * 100)); // Min 5% for visibility
        return `${pct}%`;
    }

    return (
        <section className="px-6 relative z-10">
            <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm overflow-hidden relative">
                {/* Carbon Filter Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

                <div className="relative z-10">
                    <div className="flex items-baseline justify-between mb-6">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] font-sans">FSRS Memory State</h3>
                        <span className="text-[10px] font-mono text-emerald-500 font-bold">Retention: {retentionRate}%</span>
                    </div>

                    <div className="grid grid-cols-3 gap-8">
                        {/* Mastered */}
                        <Link href="/vocabulary?status=MASTERED" className="flex flex-col group cursor-pointer">
                            <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100 leading-none group-hover:text-emerald-500 transition-colors">
                                {stats.mastered.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-zinc-500 uppercase mt-2 font-bold tracking-tighter">Mastered</span>
                            <div className="h-1 w-full bg-emerald-500/10 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"
                                    style={{ width: getWidth(stats.mastered) }}
                                />
                            </div>
                        </Link>

                        {/* Learning */}
                        <Link href="/vocabulary?status=LEARNING" className="flex flex-col group cursor-pointer">
                            <span className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100 leading-none group-hover:text-amber-500 transition-colors">
                                {stats.learning.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-zinc-500 uppercase mt-2 font-bold tracking-tighter">Learning</span>
                            <div className="h-1 w-full bg-amber-500/10 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"
                                    style={{ width: getWidth(stats.learning) }}
                                />
                            </div>
                        </Link>

                        {/* Due Now */}
                        <Link href="/vocabulary?status=REVIEW" className="flex flex-col group cursor-pointer">
                            <div className="flex items-center gap-1.5">
                                <span className="text-2xl font-mono font-bold text-rose-500 leading-none group-hover:scale-105 transition-transform">
                                    {stats.due.toLocaleString()}
                                </span>
                                {stats.due > 0 && <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>}
                            </div>
                            <span className="text-[9px] text-zinc-500 uppercase mt-2 font-bold tracking-tighter">Due Now</span>
                            <div className="h-1 w-full bg-rose-500/10 rounded-full mt-2 overflow-hidden">
                                <div
                                    className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e]"
                                    style={{ width: getWidth(stats.due) }}
                                />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
