"use client";

import React, { useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Trash2,
    Filter,
    CheckCircle2,
    ChevronRight,
    Archive,
    Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteWeaverArticle } from "@/actions/weaver-actions";
import { toast } from "sonner";
import { GlobalHeader } from "@/components/ui/global-header";
import { HeaderActionDropdown } from "@/components/dashboard/header-action-dropdown";
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
import { motion, useAnimation, PanInfo } from "framer-motion";

// Scenario → Badge Color Map
const SCENARIO_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    finance_group: { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-100 dark:border-indigo-800" },
    hr_group: { bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400", border: "border-violet-100 dark:border-violet-800" },
    ops_group: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-100 dark:border-emerald-800" },
    market_group: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-100 dark:border-amber-800" },
    office_group: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-600 dark:text-sky-400", border: "border-sky-100 dark:border-sky-800" },
    travel_group: { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", border: "border-rose-100 dark:border-rose-800" },
};
const DEFAULT_BADGE_COLOR = { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-700" };

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

    const filterStatus = searchParams.get('status');
    const filterContext = searchParams.get('context');

    const updateFilter = (type: 'status' | 'context', value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
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

    // Split articles
    const newArticles = articles.filter(a => (Date.now() - new Date(a.createdAt).getTime()) < 24 * 60 * 60 * 1000);
    const archivedArticles = articles.filter(a => (Date.now() - new Date(a.createdAt).getTime()) >= 24 * 60 * 60 * 1000);

    return (
        <div className="relative w-full min-h-screen max-w-md mx-auto bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased flex flex-col sm:shadow-2xl sm:border-x sm:border-zinc-200 dark:sm:border-zinc-800/50 shadow-black/5 overflow-hidden selection:bg-violet-100/50">

            {/* Dark Mode Ambient Glow */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none hidden dark:block z-0"></div>

            {/* ── Header (GlobalHeader 复用) ── */}
            <GlobalHeader
                title="简报中心"
                rightSlot={
                    <HeaderActionDropdown variant="weaver" />
                }
            >
                {/* Actions & Filters Row */}
                <div className="flex items-center justify-between px-1 mt-2 mb-4">

                    {/* Filter Controls */}
                    <div className="flex items-center gap-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={cn(
                                    "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm transition-all border",
                                    filterContext
                                        ? "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/40 dark:border-violet-800/60 dark:text-violet-300 ring-2 ring-violet-500/20"
                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                )}>
                                    <Filter className="w-3.5 h-3.5" strokeWidth={2} />
                                    筛选
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-lg animate-in fade-in zoom-in-95 duration-100" align="start">
                                <div className="px-2 py-1.5 text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                    语境
                                </div>

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

                        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800"></div>

                        {/* Status Toggle Group */}
                        <div className="flex p-0.5 rounded-full bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-800/60 backdrop-blur-md">
                            <button
                                onClick={() => updateFilter('status', null)}
                                className={cn(
                                    "text-[11px] px-3 py-1 rounded-full transition-all flex items-center justify-center font-medium",
                                    !filterStatus
                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                                )}
                            >全部</button>
                            <button
                                onClick={() => updateFilter('status', 'new')}
                                className={cn(
                                    "text-[11px] px-3 py-1 rounded-full transition-all flex items-center justify-center font-medium",
                                    filterStatus === 'new'
                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                                )}
                            >未读</button>
                        </div>
                    </div>

                    {/* New Built Button */}
                    <button
                        onClick={handleNewBuild}
                        className="h-8 px-3 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-bold shadow hover:bg-zinc-800 dark:hover:bg-white transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                        新建简报
                    </button>
                </div>

                {/* Stored count with spacing below */}
                <div className="flex items-center gap-2 px-1 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-medium">
                        已存储 {articles.length} 篇简报
                    </span>
                </div>
            </GlobalHeader>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto pb-24 relative z-10">

                {/* Unread Section */}
                {newArticles.length > 0 && (
                    <div className="mb-4">
                        {newArticles.map((article) => (
                            <WeaverListItem key={article.id} article={article} onDelete={handleDelete} isArchived={false} />
                        ))}
                    </div>
                )}

                {/* Archive Section */}
                {archivedArticles.length > 0 && (
                    <div>
                        <div className="px-5 py-3 flex items-center gap-2">
                            <h2 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">归档</h2>
                            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                        </div>
                        {archivedArticles.map((article) => (
                            <WeaverListItem key={article.id} article={article} onDelete={handleDelete} isArchived={true} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

// ── List Item ──
function WeaverListItem({ article, onDelete, isArchived }: { article: ArticleHistoryItem, onDelete: (id: string) => void, isArchived: boolean }) {
    const router = useRouter();
    const controls = useAnimation();
    const isDragging = useRef(false);

    const scenarioDef = WEAVER_SCENARIOS.find(s => s.id === article.scenario);
    const contextLabel = scenarioDef?.label || article.scenario || "通用情境";
    const badgeColor = SCENARIO_BADGE_COLORS[article.scenario] || DEFAULT_BADGE_COLOR;

    const handleDragStart = () => { isDragging.current = true; };
    const handleDragEnd = async (_event: any, info: PanInfo) => {
        setTimeout(() => { isDragging.current = false; }, 150);
        controls.start({ x: info.offset.x < -80 ? -80 : 0 });
    };
    const handleRowClick = () => {
        if (isDragging.current) return;
        router.push(`/weaver?id=${article.id}`);
    };

    return (
        <div className="relative w-full overflow-hidden group select-none">
            {/* Background: Delete action (hidden until swiped) */}
            <div className="absolute inset-y-0 right-0 w-20 z-0 bg-rose-500/90 dark:bg-rose-500/80 flex items-center justify-center">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button className="text-white flex flex-col items-center gap-1 p-2" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认删除简报？</AlertDialogTitle>
                            <AlertDialogDescription>
                                此操作将永久删除「{article.title}」。该操作无法撤销。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => controls.start({ x: 0 })}>取消</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                            >确认删除</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {/* Foreground: Card content */}
            <motion.div
                className={cn(
                    "relative z-10 w-full flex flex-col p-4 pr-6 border-b cursor-pointer transition-colors",
                    "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800/50",
                    "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                )}
                drag="x"
                dragConstraints={{ left: -80, right: 0 }}
                dragElastic={0.1}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{ touchAction: "pan-y" }}
                onClick={handleRowClick}
            >
                {/* Left accent stripe for unread items */}
                {!isArchived && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-violet-500"></div>
                )}

                {/* Title */}
                <div className={cn("mb-2 pr-4", isArchived ? "pl-3" : "pl-2")}>
                    <h3 className={cn(
                        "text-[16px] font-serif leading-snug transition-colors",
                        isArchived
                            ? "font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                            : "font-bold text-zinc-900 dark:text-zinc-50 group-hover:text-violet-700 dark:group-hover:text-violet-400"
                    )}>
                        {article.title}
                    </h3>
                </div>

                {/* Meta Row */}
                <div className={cn(
                    "flex items-center gap-3 text-[10px] font-mono uppercase tracking-wide",
                    isArchived ? "pl-3 text-zinc-400 dark:text-zinc-500" : "pl-2 text-zinc-500 dark:text-zinc-400"
                )}>
                    {!isArchived ? (
                        <span className={cn(
                            "px-1.5 py-0.5 rounded font-bold border",
                            badgeColor.bg, badgeColor.text, badgeColor.border
                        )}>
                            {contextLabel}
                        </span>
                    ) : (
                        <span>{contextLabel}</span>
                    )}

                    <div className={cn("w-1 h-1 rounded-full", isArchived ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-300 dark:bg-zinc-600")}></div>

                    <span suppressHydrationWarning>
                        {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true, locale: zhCN })}
                    </span>
                </div>

                {/* Hover Chevron */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className={cn("w-5 h-5", isArchived ? "text-zinc-300 dark:text-zinc-600" : "text-violet-400 dark:text-violet-400")} strokeWidth={2} />
                </div>
            </motion.div>
        </div>
    );
}
