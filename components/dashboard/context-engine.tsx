"use client";

import { motion } from "framer-motion";
import { Sparkles, Briefcase, Users, Factory, Megaphone, Monitor, Plane, BookOpen, Plus, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

const SCENARIO_ICONS: Record<string, typeof Briefcase> = {
    "Briefcase": Briefcase,
    "Users": Users,
    "Factory": Factory,
    "Megaphone": Megaphone,
    "Monitor": Monitor,
    "Plane": Plane,
    "BookOpen": BookOpen
};

// Simplified Article Type for Dashboard
interface BriefingPreview {
    id: string;
    title: string;
    scenario: string;
    createdAt: Date;
    contextLabel: string; // Pre-resolved label
    iconName: string; // Icon key from WEAVER_SCENARIOS
}

interface ContextEngineProps {
    latestArticle?: BriefingPreview | null;
}

export function ContextEngine({ latestArticle }: ContextEngineProps) {
    const router = useRouter();

    const handleCreate = () => {
        router.push("/weaver");
    };

    const handleViewArticle = () => {
        if (latestArticle) {
            router.push(`/weaver?id=${latestArticle.id}`);
        }
    };

    const handleViewAll = () => {
        router.push("/weaver/history");
    };

    const Icon = latestArticle
        ? (SCENARIO_ICONS[latestArticle.iconName] || BookOpen)
        : Sparkles;

    return (
        <section className="relative z-10 mt-9 space-y-4">
            <div className="flex items-center justify-between pl-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                        简报中心
                    </h2>
                    <Sparkles className="w-3 h-3 text-violet-500" />
                </div>

                <div className="flex items-center gap-3">
                    {/* Quick Action: New Briefing */}
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-1 rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                    >
                        <Plus className="w-3 h-3" strokeWidth={2} />
                        NEW
                    </button>

                    <button
                        onClick={handleViewAll}
                        className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                        View All
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {latestArticle ? (
                    /* Existing Article Card */
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleViewArticle}
                        className="group relative w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 dark:backdrop-blur-xl shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] cursor-pointer hover:border-violet-300 dark:hover:border-violet-500/50 transition-colors"
                    >
                        {/* Highlights */}
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="w-24 h-24 text-violet-500 -rotate-12" />
                        </div>

                        <div className="relative p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-zinc-800 flex items-center justify-center text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-white/5">
                                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">LATEST BRIEFING</span>
                                            <span className="w-1 h-1 rounded-full bg-violet-500"></span>
                                        </div>
                                        <h3 className="font-serif font-bold text-base text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                            {latestArticle.title}
                                        </h3>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {formatDistanceToNow(new Date(latestArticle.createdAt), { addSuffix: true })}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                                    <Quote className="w-3 h-3 text-zinc-400" />
                                    <span className="font-medium">{latestArticle.contextLabel}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    /* Empty State Card */
                    <motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreate}
                        className="group relative w-full rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 hover:border-violet-300 dark:hover:border-violet-500/30 cursor-pointer transition-all p-6 flex flex-col items-center justify-center gap-3 text-center"
                    >
                        <div className="h-12 w-12 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-violet-500 transition-colors">
                            <Plus className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">构建第一份简报</h3>
                            <p className="text-xs text-zinc-500 mt-1">
                                为你的日常学习生成语境内容
                            </p>
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
