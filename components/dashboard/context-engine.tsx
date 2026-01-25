"use client";

import { motion } from "framer-motion";
import { Plane, Handshake, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Sub-Component: Topic Card ---

interface TopicCardProps {
    title: string;
    icon: React.ElementType;
    status: "new" | "drafting";
    preview: React.ReactNode;
}

function TopicCard({ title, icon: Icon, status, preview }: TopicCardProps) {
    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-start gap-4 p-4 rounded-xl border border-border bg-surface dark:bg-zinc-900/60 dark:border-white/15 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
            <div className="flex-shrink-0 p-3 rounded-lg bg-background border border-border">
                <Icon className="w-5 h-5 text-foreground" />
            </div>

            <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
                    {status === "new" && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-core bg-brand-core/10 rounded-md">
                            新
                        </span>
                    )}
                    {status === "drafting" && (
                        <span className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium text-secondary bg-zinc-100 dark:bg-zinc-800 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-core animate-pulse" />
                            AI 撰写中
                        </span>
                    )}
                </div>

                <div className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-serif line-clamp-2">
                    {preview}
                </div>
            </div>

            {/* Draft State Overlay or Arrow */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
        </motion.div>
    );
}

// --- Main Component ---

export function ContextEngine() {
    return (
        <section className="relative z-10 mt-9 space-y-4">
            <div className="flex items-center justify-between pl-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Context Engine</h2>
                    <Sparkles className="w-3 h-3 text-violet-500" />
                </div>
                <button className="text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline">View All</button>
            </div>

            <div className="space-y-3">
                {/* Item A: Ready */}
                <div className="group relative w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm active:scale-[0.99] transition-all cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-100/50 dark:to-zinc-800/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative p-4 flex gap-4">
                        <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5">
                            <Plane className="w-6 h-6 stroke-[1.5px]" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Topic: Business Travel</h3>
                                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-500/20">NEW</span>
                            </div>
                            <p className="font-serif text-sm text-zinc-800 dark:text-zinc-200 leading-snug truncate">
                                "Please note the <span className="text-violet-600 dark:text-violet-400 font-medium italic">mandatory</span> changes to the itinerary..."
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1 rounded">itinerary</span>
                                <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-1 rounded">reimbursement</span>
                                <span className="text-[10px] text-zinc-500">+3</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Item B: Drafting */}
                <div className="group relative w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm active:scale-[0.99] transition-all cursor-pointer">
                    <div className="relative p-4 flex gap-4">
                        <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5">
                            <Handshake className="w-6 h-6 stroke-[1.5px]" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Topic: Negotiation</h3>
                            <div className="flex items-center gap-2">
                                <p className="font-serif text-sm text-zinc-400 dark:text-zinc-500 leading-snug italic">
                                    AI Agent is drafting a memo...
                                </p>
                                <span className="block w-1.5 h-4 bg-violet-500 animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
