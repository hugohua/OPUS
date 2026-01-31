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
    // Color logic
    let rankColor = "text-zinc-400 dark:text-zinc-600"; // Light: neutral, Dark: muted
    // Actually, Rank should be visible. 
    // Light: text-zinc-500. Dark: text-zinc-500.
    rankColor = "text-zinc-500";
    let statusColor = "text-zinc-500";
    let statusBg = "bg-zinc-800/10";
    let statusText = "Unknown";
    let barColor = "bg-zinc-700";

    const s = item.fsrs;

    if (s.status === 'MASTERED') {
        statusColor = "text-emerald-500";
        statusBg = "bg-emerald-500/10";
        statusText = "Stable";
        barColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
    } else if (s.status === 'LEARNING' || s.status === 'REVIEW') {
        if (s.isLeech) {
            statusColor = "text-rose-500";
            statusBg = "bg-rose-500/10";
            statusText = "Leech";
            barColor = "bg-rose-500";
        } else if (s.nextReview && new Date(s.nextReview) <= new Date()) {
            statusColor = "text-amber-500";
            statusBg = "bg-amber-500/10";
            statusText = "Due";
            barColor = "bg-amber-500";
        } else {
            statusColor = "text-amber-500"; // Learning/Review generally active
            statusBg = "bg-amber-500/10";
            statusText = s.status === 'REVIEW' ? 'Reviewing' : 'Learning';
            barColor = "bg-amber-500";
        }
    } else {
        // New
        rankColor = "text-zinc-600";
        statusText = "New";
        // New items might not show status pill in demo, or just grey?
    }

    // Rank styling
    if (item.abceedRank && item.abceedRank <= 1000) rankColor = "text-emerald-600";
    else if (item.abceedRank && item.abceedRank <= 2000) rankColor = "text-amber-600";


    const nextReviewDays = s.nextReview
        ? Math.ceil((new Date(s.nextReview).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    let dueText = "";
    if (s.status === 'NEW') dueText = "Not started";
    else if (nextReviewDays <= 0) dueText = "Due Today";
    else dueText = `Review: ${nextReviewDays}d`;


    return (
        <div
            style={style}
            onClick={onClick}
            className="group flex items-center px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
        >
            {/* ID */}
            <div className="w-10 shrink-0 text-[10px] font-mono font-bold mr-2 text-right">
                <span className={cn(rankColor)}>{item.abceedRank ? `#${item.abceedRank}` : '-'}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 mx-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {item.word}
                    </span>

                    {/* Status Pill (Only if not New or strict condition) */}
                    {s.status !== 'NEW' && (
                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/5", statusColor, statusBg)}>
                            {statusText}
                        </span>
                    )}

                    {/* Has Context Icon */}
                    {s.hasContext && (
                        <Sparkles className="w-3 h-3 text-violet-400 fill-violet-400/20" />
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px] md:max-w-md">
                    {item.definition}
                </p>
            </div>

            {/* Right: State */}
            <div className="text-right w-24 shrink-0 flex flex-col items-end gap-1">
                {s.status !== 'NEW' ? (
                    <>
                        <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full", barColor)}
                                style={{ width: `${s.retention}%` }}
                            />
                        </div>
                        <div className={cn("text-[10px] font-mono", nextReviewDays <= 0 ? "text-amber-500 font-bold" : "text-zinc-500")}>
                            {dueText}
                        </div>
                    </>
                ) : (
                    <div className="text-[10px] text-zinc-600 font-mono">Unseen</div>
                )}
            </div>
        </div>
    );
}
