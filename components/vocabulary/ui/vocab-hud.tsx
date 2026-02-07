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
    // The rest is "New" or "Index". Demo showed Zinc for the rest.

    // Demo header structure:
    // Left: Title + Subtitle
    // Right: Big Number (Mastered) + Label
    // Bottom: Progress Bar

    return (
        <header className="shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 z-20">
            <div className="flex items-end justify-between mb-4">
                <div>
                    <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">词库</h1>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">TOEIC Core • FSRS v4.5</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-emerald-500">
                        {stats.mastered.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">已掌握</div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${masteredPct}%` }}
                />
                <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${learningPct}%` }}
                />
                {/* Remaining space is implicitly zinc-800 (background) or we add a zinc-700 segment for "seen but not learning"? 
                    Demo said: "bg-zinc-700 w-[45%]" for the last part. 
                    Let's assume the background covers 'New' or 'Locked', 
                    but if we want specific color for 'New', we can add another div.
                    For now, background is fine.
                */}
            </div>
        </header>
    );
}
