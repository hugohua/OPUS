import React from "react";
import { Loader2, AlertCircle, RefreshCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export interface WordItem {
    id: number;
    word: string;
    meaning: string;
    source?: string;
}

interface RawMaterialsProps {
    isLoading: boolean;
    error: string | null;
    priorityWords: WordItem[];
    fillerWords: WordItem[];
    onRefresh: () => void;
}

export function RawMaterials({
    isLoading,
    error,
    priorityWords,
    fillerWords,
    onRefresh
}: RawMaterialsProps) {
    const totalCount = priorityWords.length + fillerWords.length;
    const isFreeReading = !isLoading && totalCount === 0 && !error;

    return (
        <section className="px-6 py-8">
            {/* Header with SVG Icon */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h2 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
                        原料词库
                    </h2>
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                        title="刷新"
                    >
                        <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Word Chips - Flow Layout */}
            <div>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-mono">同步原料中...</span>
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 text-rose-500 py-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">{error}</span>
                    </div>
                ) : isFreeReading ? (
                    <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center">
                        <span className="text-xs text-zinc-400">暂无待学词汇，自由阅读模式。</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {/* Top 3 Priority Words */}
                        {priorityWords.slice(0, 3).map((w) => (
                            <div
                                key={w.id}
                                className="group relative pl-3 pr-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-sm flex items-center gap-2 hover:border-violet-300 dark:hover:border-violet-500 transition-colors cursor-default"
                            >
                                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{w.word}</span>
                                <span
                                    className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        w.source === "due_matched" || w.source === "due_fallback" ? "bg-rose-500" : "bg-amber-500"
                                    )}
                                ></span>
                            </div>
                        ))}

                        {/* Collapsed Indicator -> Dialog Trigger */}
                        {(priorityWords.length > 3 || fillerWords.length > 0) && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="pl-3 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 border-dashed rounded-md flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                        <span className="text-sm font-mono text-zinc-400">
                                            +{priorityWords.length - 3 > 0 ? priorityWords.length - 3 + fillerWords.length : fillerWords.length} 更多
                                        </span>
                                        <ChevronRight className="w-3 h-3 text-zinc-400" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>原料词库 ({priorityWords.length + fillerWords.length})</DialogTitle>
                                        <DialogDescription>
                                            这些是本次生成所需的词汇原料，包含复习词和新词
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-6 py-4">
                                        {/* Priority Section */}
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">优先词汇</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {priorityWords.map((w) => (
                                                    <div key={w.id} className="px-3 py-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                        {w.word}
                                                        <span
                                                            className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                w.source?.includes("due") ? "bg-rose-500" : "bg-amber-500"
                                                            )}
                                                            title={w.source?.includes("due") ? "待复习" : "新词"}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Filler Section */}
                                        {fillerWords.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">补充词汇</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {fillerWords.map((w) => (
                                                        <div key={w.id} className="px-3 py-1.5 rounded bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-sm font-mono text-zinc-500 dark:text-zinc-400">
                                                            {w.word}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
