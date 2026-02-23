'use client';

import { cn } from "@/lib/utils";
import { VocabListItem } from "@/actions/get-vocab-list";
import { Sparkles } from "lucide-react";

interface VocabListItemProps {
    item: VocabListItem;
    style: React.CSSProperties; // For virtualization positioning
    onClick: () => void;
}

export function VocabListItemRow({ item, style, onClick }: VocabListItemProps) {
    const s = item.fsrs;

    // Default styles for 'NEW' (uninitiated)
    let leftAccentColor = "bg-slate-200 dark:bg-zinc-800 group-hover:bg-indigo-300 dark:group-hover:bg-indigo-500 transition-colors";
    let titleColor = "text-slate-700 dark:text-zinc-300";
    let showTelemetry = false;

    // Status Tag (Only shown for New, Due, Leech)
    let tagElement = null;

    if (s.status === 'MASTERED') {
        leftAccentColor = "bg-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity";
        titleColor = "text-slate-900 dark:text-zinc-100";
        showTelemetry = true;
    } else if (s.status === 'LEARNING' || s.status === 'REVIEW') {
        titleColor = "text-slate-900 dark:text-zinc-100";
        showTelemetry = true;

        const isDue = s.nextReview && new Date(s.nextReview) <= new Date();

        if (s.isLeech) {
            leftAccentColor = "bg-rose-500";
            tagElement = (
                <span className="px-1 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest shrink-0">
                    Leech
                </span>
            );
        } else if (isDue) {
            leftAccentColor = "bg-amber-500";
            tagElement = (
                <span className="px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest shrink-0">
                    Due
                </span>
            );
        } else {
            // Learning/Review (Not due)
            leftAccentColor = "bg-indigo-400 opacity-80 dark:bg-indigo-500";
        }
    } else {
        // NEW
        tagElement = (
            <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/50 text-[9px] font-mono font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest shrink-0">
                New
            </span>
        );
    }

    // Attempt to extract Part of Speech from definition if possible, else default to '-'
    // Assuming format "v. do something; n. something"
    let pos = "";
    let cleanDef = item.definition || "暂无释义";
    const posMatch = cleanDef.match(/^([a-z]+?\.)\s+(.*)/);
    if (posMatch) {
        pos = posMatch[1]; // e.g. "v."
        cleanDef = posMatch[2];
    } else if (cleanDef.includes(".")) {
        // rough fallback
        const split = cleanDef.split(/(\.|，)/);
        if (split[0].length <= 5 && split[0].match(/^[a-z]+$/)) {
            pos = split[0] + ".";
            cleanDef = cleanDef.substring(pos.length).trim();
        }
    }

    // Fallback if no POS extracted
    if (!pos) pos = "w.";

    // Calculate Next Review formatting
    const nextReviewDays = s.nextReview
        ? Math.ceil((new Date(s.nextReview).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    let nextLabel = "Not initiated";
    let nextValueClass = "text-slate-400";
    let nextValueText = "";

    if (showTelemetry) {
        if (nextReviewDays <= 0) {
            nextValueClass = "text-amber-600 dark:text-amber-500 font-bold";
            nextValueText = "Today";
        } else if (nextReviewDays === 1) {
            nextValueClass = "text-indigo-600 dark:text-indigo-400 font-bold";
            nextValueText = "Tomorrow";
        } else {
            nextValueClass = "text-slate-800 dark:text-zinc-300 font-bold";
            nextValueText = `${nextReviewDays}d`;
        }
    }

    // Telemetry Colors (R/S)
    const RColor = s.retention >= 90 ? "text-emerald-600 dark:text-emerald-500" : (s.retention < 80 ? "text-amber-600 dark:text-amber-500" : "text-slate-700 dark:text-zinc-300");
    const SColor = s.stability >= 21 ? "text-emerald-600 dark:text-emerald-500" : "text-slate-700 dark:text-zinc-300";

    return (
        <div
            style={style}
            onClick={onClick}
            className={cn(
                "group flex items-start justify-between p-3.5 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-zinc-950",
                "hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer relative",
                !showTelemetry && "opacity-60 hover:opacity-100" // DIM non-initiated words
            )}
        >
            {/* Absolute Status via Accent Lines */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", leftAccentColor)}></div>

            <div className="flex-1 min-w-0 flex flex-col gap-1 pl-2.5">
                <div className="flex items-center gap-2">
                    <h3 className={cn("font-bold text-base truncate tracking-tight", titleColor)}>
                        {item.word}
                    </h3>
                    {tagElement}
                    {s.hasContext && <Sparkles className="w-3 h-3 text-violet-400 fill-violet-400/30 shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:text-zinc-400 dark:bg-zinc-800/50 px-1 rounded border border-transparent dark:border-white/5 shrink-0">
                        {pos}
                    </span>
                    <p className="text-[13px] text-slate-500 dark:text-zinc-500 truncate">
                        {cleanDef}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-end shrink-0 ml-4 justify-center gap-1.5 h-full">
                {showTelemetry ? (
                    <>
                        <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-500">
                            Next: <span className={nextValueClass}>{nextValueText}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-mono">
                            <span className="text-slate-400 dark:text-zinc-500" title="Retrievability">
                                R: <span className={cn("font-bold", RColor)}>{s.retention.toFixed(0)}%</span>
                            </span>
                            <span className="text-slate-400 dark:text-zinc-500" title="Stability">
                                S: <span className={cn("font-bold", SColor)}>{s.stability.toFixed(1)}</span>
                            </span>
                        </div>
                    </>
                ) : (
                    <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600 mt-0.5">Not initiated</span>
                )}
            </div>
        </div>
    );
}
