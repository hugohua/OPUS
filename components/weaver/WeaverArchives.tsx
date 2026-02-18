"use client";

import React, { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Trash2,
    BookOpen,
    Plus,
    Filter,
    Archive,
    CheckCircle2,
    Briefcase,
    Users,
    Factory,
    Megaphone,
    Monitor,
    Plane,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteWeaverArticle } from "@/actions/weaver-actions";
import { toast } from "sonner";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";
import { cva } from "class-variance-authority";
import { motion, useAnimation, PanInfo } from "framer-motion";

const SCENARIO_ICONS: Record<string, typeof Briefcase> = {
    "Briefcase": Briefcase,
    "Users": Users,
    "Factory": Factory,
    "Megaphone": Megaphone,
    "Monitor": Monitor,
    "Plane": Plane,
    "BookOpen": BookOpen
};

// CVA for List Item
const listItemVariants = cva(
    "absolute inset-0 border rounded-xl flex items-center p-5 z-10 cursor-pointer transition-all duration-300 ease-out",
    {
        variants: {
            intent: {
                // Light: Paper / Dark: Glass with Highlight
                default: "bg-white border-zinc-200 shadow-sm dark:bg-zinc-900/60 dark:border-white/15 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-md",
            }
        },
        defaultVariants: {
            intent: "default"
        }
    }
);

interface ArticleHistoryItem {
    id: string;
    title: string;
    createdAt: Date;
    scenario: string;
    vocabPreview: string;
}

interface WeaverArchivesProps {
    articles: ArticleHistoryItem[];
    contexts: string[];
}

export function WeaverArchives({ articles, contexts }: WeaverArchivesProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get active filters from URL
    const filterStatus = searchParams.get('status');
    const filterContext = searchParams.get('context');

    const updateFilter = (type: 'status' | 'context', value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value) {
            // Toggle logic
            if (params.get(type) === value) {
                params.delete(type);
            } else {
                params.set(type, value);
            }
        } else {
            params.delete(type);
        }

        router.refresh();
        router.push(`?${params.toString()}`);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteWeaverArticle(id);
            toast.success("已删除", { description: "简报已永久删除" });
            router.refresh();
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("操作失败", { description: "无法删除该简报，请稍后重试" });
        }
    };

    const handleNewBuild = () => {
        router.push("/weaver");
    };

    return (
        <div className="relative min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased flex flex-col selection:bg-violet-100/50">

            {/* Dark Mode Ambient Glow */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none hidden dark:block z-0"></div>

            {/* Header */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                        <Archive className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">简报中心</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-medium">
                                已存储 {articles.length} 篇简报
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className={cn(
                                "h-11 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center gap-2 min-h-[44px]", // Mobile target size
                                (filterStatus || filterContext)
                                    ? "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-300"
                                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            )}>
                                <Filter className="w-3.5 h-3.5 text-current" strokeWidth={1.5} />
                                筛选 {(filterStatus || filterContext) && '(1)'}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg animate-in fade-in zoom-in-95 duration-100" align="end">
                            {/* Status Section */}
                            <div className="px-2 py-1.5 text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                状态 (Status)
                            </div>
                            <button
                                onClick={() => updateFilter('status', 'new')}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left group transition-colors min-h-[44px]"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                                    <span className={cn(
                                        "text-sm font-medium transition-colors",
                                        filterStatus === 'new' ? "text-violet-600 dark:text-violet-400" : "text-zinc-700 dark:text-zinc-300"
                                    )}>新生成 / 未读</span>
                                </div>
                                {filterStatus === 'new' && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" strokeWidth={1.5} />
                                )}
                            </button>
                            <button
                                onClick={() => updateFilter('status', 'archived')}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors min-h-[44px]"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
                                    <span className={cn(
                                        "text-sm font-medium transition-colors",
                                        filterStatus === 'archived' ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
                                    )}>已归档</span>
                                </div>
                                {filterStatus === 'archived' && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" strokeWidth={1.5} />
                                )}
                            </button>

                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>

                            {/* Context Section */}
                            <div className="px-2 py-1.5 text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                语境 (Context)
                            </div>

                            {/* All Contexts Button */}
                            <button
                                onClick={() => updateFilter('context', null)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors min-h-[44px]"
                            >
                                <span className={cn(
                                    "text-sm font-medium transition-colors",
                                    !filterContext ? "text-violet-600 dark:text-violet-400" : "text-zinc-600 dark:text-zinc-400"
                                )}>全部语境</span>
                                {!filterContext && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" strokeWidth={1.5} />
                                )}
                            </button>

                            {contexts.map(ctxId => {
                                const scenario = WEAVER_SCENARIOS.find(s => s.id === ctxId);
                                const label = scenario?.label || ctxId;

                                return (
                                    <button
                                        key={ctxId}
                                        onClick={() => updateFilter('context', ctxId)}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors min-h-[44px]"
                                    >
                                        <span className={cn(
                                            "text-sm font-medium transition-colors",
                                            filterContext === ctxId ? "text-violet-600 dark:text-violet-400" : "text-zinc-600 dark:text-zinc-400"
                                        )}>{label}</span>
                                        {filterContext === ctxId && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" strokeWidth={1.5} />
                                        )}
                                    </button>
                                );
                            })}

                        </PopoverContent>
                    </Popover>

                    <button
                        onClick={handleNewBuild}
                        className="h-11 px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center gap-2 min-h-[44px]"
                    >
                        <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                        新建简报
                    </button>
                </div>
            </header>

            <main className="relative flex-1 p-6 max-w-5xl mx-auto w-full space-y-4 z-10">

                {/* List Items */}
                <div className="space-y-3 overflow-visible">
                    {articles.map((article) => {
                        return <WeaverListItem key={article.id} article={article} onDelete={handleDelete} />;
                    })}
                </div>

            </main>

        </div>
    );
}

function WeaverListItem({ article, onDelete }: { article: ArticleHistoryItem, onDelete: (id: string) => void }) {
    const router = useRouter();
    const controls = useAnimation();
    const isDragging = useRef(false);

    // Status Logic
    const isNew = (Date.now() - new Date(article.createdAt).getTime()) < 24 * 60 * 60 * 1000;

    // Resolve Scenario Label
    const scenarioDef = WEAVER_SCENARIOS.find(s => s.id === article.scenario);
    const contextLabel = scenarioDef?.label ||
        article.scenario || "通用情境";

    // Resolve Icon
    const IconName = scenarioDef?.icon || "BookOpen";
    // @ts-ignore
    const Icon = SCENARIO_ICONS[IconName] || BookOpen;

    const handleDragStart = () => {
        isDragging.current = true;
    };

    const handleDragEnd = async (event: any, info: PanInfo) => {
        // We delay resetting isDragging to ensure onClick (which fires immediately after) can detect the drag state
        setTimeout(() => {
            isDragging.current = false;
        }, 150);

        if (info.offset.x < -80) {
            // Swiped Left -> Open
            controls.start({ x: -100 });
        } else {
            // Snap back
            controls.start({ x: 0 });
        }
    };

    const handleRowClick = () => {
        // Prevent navigation if we were just dragging
        if (isDragging.current) return;
        router.push(`/weaver?id=${article.id}`);
    };

    return (
        <div className="relative w-full h-24 rounded-xl overflow-visible group select-none">
            {/* Background Action Layer (Delete Button) */}
            <div className="absolute inset-0 bg-rose-500/90 dark:bg-rose-500/80 backdrop-blur flex items-center justify-end pr-6 rounded-xl">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            className="text-white font-bold flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                            <span>删除</span>
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认删除简报？</AlertDialogTitle>
                            <AlertDialogDescription>
                                此操作将永久删除 "{article.title}"。该操作无法撤销。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => controls.start({ x: 0 })}>取消</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(article.id);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                确认删除
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {/* Foreground Content Layer */}
            <motion.div
                className={listItemVariants({ intent: "default" })}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ touchAction: "pan-y" }}
                onClick={handleRowClick}
            >
                {/* Status Indicator (Left Stripe) */}
                {isNew && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-violet-500 rounded-r-full"></div>
                )}

                <div className="flex flex-col gap-2 flex-1 min-w-0 pr-2">
                    {/* Title Row */}
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-serif font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {article.title}
                        </h3>
                        {isNew && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-[10px] font-mono font-bold text-violet-600 dark:text-violet-300">新</span>
                        )}
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        {/* Scenario */}
                        <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                            <span className="text-zinc-600 dark:text-zinc-300 font-bold">{contextLabel}</span>
                        </div>

                        <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></div>

                        {/* Time */}
                        <div className="flex items-center gap-1.5" suppressHydrationWarning>
                            <Clock className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                            <span>
                                {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}





