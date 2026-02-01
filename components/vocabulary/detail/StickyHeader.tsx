'use client';

import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StickyHeaderProps {
    stability: number; // FSRS Stability (days)
    isReviewPhase?: boolean;
    rank?: number | null;
    className?: string;
}

export function StickyHeader({ stability, isReviewPhase = true, rank, className }: StickyHeaderProps) {
    const router = useRouter();

    return (
        <header className={cn(
            "fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-14 transition-colors duration-500",
            "bg-white/80 backdrop-blur-md border-b border-zinc-200", // Light mode
            "dark:bg-zinc-900/60 dark:border-white/15", // Dark mode glassmorphism
            className
        )}>
            {/* Left: Back */}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="gap-1 pl-0 text-zinc-400 hover:text-white hover:bg-transparent"
                aria-label="Go back"
            >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-xs font-medium">List</span>
            </Button>

            {/* Center: Rank Badge + FSRS Status */}
            <div className="flex flex-col items-center gap-1">
                {/* Rank Badge */}
                {rank && (
                    <Badge
                        variant="outline"
                        className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold border-0",
                            rank < 3000
                                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                        )}
                    >
                        <span className="mr-1">#</span>{rank} {rank < 3000 ? "CORE" : ""}
                    </Badge>
                )}

                {/* FSRS Status */}
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-500 uppercase">
                        {isReviewPhase ? "Review" : "Learning"}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600">•</span>
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono">
                        S:{stability.toFixed(0)}d
                    </span>
                </div>
            </div>

            {/* Right: Actions */}
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                <MoreHorizontal className="w-5 h-5" />
            </Button>
        </header>
    );
}
