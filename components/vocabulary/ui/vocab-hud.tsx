'use client';

import { cn } from "@/lib/utils";

interface VocabHudProps {
    stats: {
        mastered: number;
        learning: number;
        due: number; // or total? Usually total for progress bar denominator? 
        // Let's assume total is handled or we use percentages.
        // Actually, the progress bar in demo shows segments.
        // We probably need total count to calc width %.
    };
    totalCount: number; // For progress calc
}
export function VocabHud({ stats, totalCount }: VocabHudProps) {
    const masteredPct = totalCount > 0 ? (stats.mastered / totalCount) * 100 : 0;
    const learningPct = totalCount > 0 ? (stats.learning / totalCount) * 100 : 0;

    return (
        <header className="px-5 py-4 flex items-center justify-between shrink-0 pointer-events-auto">
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight shrink-0">
                词库
            </h1>

            {/* Progress Bar centered */}
            <div className="flex-1 mx-6 max-w-[200px] h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${masteredPct}%` }}
                />
                <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${learningPct}%` }}
                />
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hidden sm:inline-block">已掌握</span>
                <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {stats.mastered.toLocaleString()}
                </span>
            </div>
        </header>
    );
}
