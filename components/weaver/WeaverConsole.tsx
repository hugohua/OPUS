"use client";

/**
 * Weaver Console (The Lab) v2.2 - Refactored
 * 
 * 功能：
 *   1. 界面风格：参考 Demo 优化，移除网格，使用 Slate-50 背景
 *   2. layout：全屏 Flex 布局，Sticky Header/Footer
 *   3. 组件：Raw Materials (Queue), Context Selection, Density
 *   4. 重构：拆分为子组件
 * 
 * 作者: Hugo
 * 日期: 2026-02-15
 */

import React, { useEffect, useState } from "react";
import { getWeaverIngredients } from "@/actions/weaver-selection";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Sparkles, History, Factory } from "lucide-react";
import Link from "next/link";
import { GlobalHeader } from "@/components/ui/global-header";

import { RawMaterials, WordItem } from "./console/RawMaterials";
import { ContextSelector } from "./console/ContextSelector";
import { DensitySelector } from "./console/DensitySelector";
import { DEFAULT_WEAVER_DENSITY, WEAVER_DENSITY_CONFIGS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

// ============================================
// Types
// ============================================
interface WeaverConsoleProps {
    onStart: (scenario: string, density: string, words: WordItem[]) => void;
}

/**
 * Weaver Console - Light Mode & Dark Mode Support
 */
export function WeaverConsole({ onStart }: WeaverConsoleProps) {
    const { data: session } = useSession();
    const [selectedScenario, setSelectedScenario] = useState("finance_group");
    const [selectedDensity, setSelectedDensity] = useState(DEFAULT_WEAVER_DENSITY);
    const [priorityWords, setPriorityWords] = useState<WordItem[]>([]);
    const [fillerWords, setFillerWords] = useState<WordItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 加载词汇
    useEffect(() => {
        if (!session?.user?.id) return;
        loadIngredients(session.user.id, selectedScenario);
    }, [session?.user?.id, selectedScenario]);

    async function loadIngredients(userId: string, scenario: string, forceRefresh = false) {
        setIsLoading(true);
        setError(null);
        try {
            const res = await getWeaverIngredients(userId, scenario, forceRefresh);
            if (res.status === "success" && res.data) {
                setPriorityWords(res.data.priorityWords);
                setFillerWords(res.data.fillerWords);
            } else {
                setError(res.message || "加载失败");
                toast.error("词汇加载失败");
            }
        } catch {
            setError("网络错误");
        } finally {
            setIsLoading(false);
        }
    }

    const handleWeave = () => {
        onStart(selectedScenario, selectedDensity, [...priorityWords, ...fillerWords]);
    };

    return (
        <div className="relative w-full h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased flex flex-col overflow-hidden selection:bg-violet-100 dark:selection:bg-violet-900/30">

            {/* Ambient Glow for Dark Mode */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none hidden dark:block"></div>



            {/* Header - Sticky Top */}
            <GlobalHeader
                title="简报生成"
                showStatusLight={true}
                leftSlot={
                    <Factory className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                }
                rightSlot={
                    <Link
                        href="/weaver/history"
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-all shadow-sm hover:shadow active:scale-95 group"
                        title="查看历史记录"
                    >
                        <History className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100 transition-colors" />
                        <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100 transition-colors">简报中心</span>
                    </Link>
                }
            />

            <main className="flex-1 overflow-y-auto pb-32 relative z-10">

                <RawMaterials
                    isLoading={isLoading}
                    error={error}
                    priorityWords={priorityWords}
                    fillerWords={fillerWords}
                    onRefresh={() => session?.user?.id && loadIngredients(session.user.id, selectedScenario, true)}
                />

                <ContextSelector
                    selectedScenario={selectedScenario}
                    onSelect={setSelectedScenario}
                    disabled={isLoading}
                />

                <DensitySelector
                    selectedDensity={selectedDensity}
                    onSelect={setSelectedDensity}
                    disabled={isLoading}
                />

            </main>

            {/* Footer / Floating Bar */}
            <div className="fixed bottom-0 left-0 w-full px-6 py-4 bg-white/90 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800 backdrop-blur-lg z-30">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                            Estimated Output
                        </span>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>~{WEAVER_DENSITY_CONFIGS.find(d => d.id === selectedDensity)?.wordCount || 300} 词</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                            <span>{priorityWords.length + fillerWords.length} 目标词</span>
                        </div>
                    </div>

                    <button
                        onClick={handleWeave}
                        disabled={isLoading || (priorityWords.length === 0 && fillerWords.length === 0)}
                        className={cn(
                            "relative group px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:shadow-none",
                            isLoading || (priorityWords.length === 0 && fillerWords.length === 0)
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-700"
                                : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-violet-500/20 dark:shadow-violet-500/40 hover:shadow-violet-500/40 dark:hover:shadow-violet-500/20"
                        )}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>生成中...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-violet-400 dark:text-violet-500 group-hover:text-violet-300 dark:group-hover:text-violet-600 transition-colors" />
                                    <span>开始生成</span>
                                </>
                            )}
                        </span>
                    </button>
                </div>
            </div>
        </div >
    );
}
