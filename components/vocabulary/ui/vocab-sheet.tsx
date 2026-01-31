'use client';

import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerClose,
} from "@/components/ui/drawer";
import { VocabListItem } from "@/actions/get-vocab-list";
import { cn } from "@/lib/utils";
import { Volume2, RefreshCw, X, AlertTriangle, Sparkles as SparklesIcon, TrendingUp, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VocabSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: VocabListItem | null;
}

export function VocabSheet({ open, onOpenChange, item }: VocabSheetProps) {
    if (!item) return null;

    const s = item.fsrs;

    // Safety check for null date
    const nextReviewDate = s.nextReview ? new Date(s.nextReview).toLocaleDateString() : "Now";

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 border-t max-h-[90vh] focus:outline-none">
                <div className="mx-auto w-full max-w-md">
                    {/* Header: Identity */}
                    <DrawerHeader className="relative border-b border-zinc-100 dark:border-zinc-900 pb-6 pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <DrawerTitle className="text-3xl font-serif font-bold text-zinc-900 dark:text-white tracking-tight">
                                        {item.word}
                                    </DrawerTitle>
                                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-[10px] font-mono text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                                        Rank #{item.abceedRank || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-zinc-400">
                                    {item.phonetic && <span className="font-mono text-sm">/{item.phonetic}/</span>}
                                    <button className="p-1 rounded-full hover:bg-zinc-800 text-indigo-400 transition-colors">
                                        <Volume2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-3">
                                    <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed">
                                        {item.definition}
                                    </p>
                                </div>
                            </div>
                            <DrawerClose asChild>
                                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white -mr-2 -mt-2">
                                    <X className="w-5 h-5" />
                                </Button>
                            </DrawerClose>
                        </div>
                    </DrawerHeader>

                    <div className="p-6 space-y-8 overflow-y-auto">

                        {/* Section 1: Memory Diagnostics */}
                        <section>
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                Memory Diagnostics
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 text-center">
                                    <div className="text-[10px] text-zinc-500 uppercase">Stability</div>
                                    <div className="text-xl font-mono font-bold text-emerald-400">
                                        {s.stability.toFixed(0)}d
                                    </div>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 text-center">
                                    <div className="text-[10px] text-zinc-500 uppercase">Difficulty</div>
                                    <div className="text-xl font-mono font-bold text-zinc-600 dark:text-zinc-300">
                                        {s.difficulty.toFixed(1)}
                                    </div>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 text-center">
                                    <div className="text-[10px] text-zinc-500 uppercase">Retention</div>
                                    <div className="text-xl font-mono font-bold text-indigo-400">
                                        {s.retention.toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            {/* Visual Retention Curve (Mock) */}
                            <div className="mt-3 h-16 w-full bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200 dark:border-zinc-800/50 relative overflow-hidden flex items-end">
                                <svg className="w-full h-full text-emerald-500/10 fill-current" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <path d="M0,0 Q30,80 100,90 V100 H0 Z" />
                                </svg>
                                <div className="absolute top-2 right-2 text-[9px] font-mono text-zinc-500">
                                    Next Review: {nextReviewDate}
                                </div>
                            </div>
                        </section>

                        {/* Section 2: AI Context Trace */}
                        <section>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                                    <BrainCircuit className="w-3 h-3" />
                                    AI Context Trace
                                </h3>
                                <button className="text-[10px] flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white transition-colors">
                                    <RefreshCw className="w-3 h-3" />
                                    Regenerate
                                </button>
                            </div>

                            {s.contextSentence ? (
                                <div className="bg-gradient-to-br from-violet-900/10 to-transparent p-4 rounded-xl border border-violet-500/20 relative">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 rounded-l-xl"></div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-200 italic leading-relaxed font-serif">
                                        "{s.contextSentence}"
                                    </p>
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-zinc-500 bg-white/50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-violet-200 dark:border-zinc-800">
                                            Business Context
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-center">
                                    <p className="text-xs text-zinc-500 italic">No context generated yet.</p>
                                </div>
                            )}
                        </section>

                        {/* Section 3: Distractor Trap (Only if Leech) */}
                        {s.isLeech && (
                            <section>
                                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Distractor Trap
                                </h3>
                                <div className="text-xs text-zinc-400 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800">
                                    Marked as <span className="text-rose-400 font-bold">Leech</span> (High Failure Rate).
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <DrawerFooter className="border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 pb-8 pt-4">
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                Suspend Card
                            </Button>
                            <Button variant="ghost" className="flex-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white">
                                Reset Progress
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
