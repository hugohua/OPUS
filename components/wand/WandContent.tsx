"use client";

import React from "react";
import { type WandWordOutput } from "@/lib/validations/weaver-wand-schemas";
import { EtymologyCard } from "@/components/vocab/EtymologyCard";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Activity } from "lucide-react";

interface WandContentProps {
    data: WandWordOutput;
    isAILoading?: boolean;
    className?: string;
}

/**
 * Magic Wand 内容组件 (V2)
 * 
 * 架构:
 * - Layer 1: Local DNA (0ms, Cache-First) -> 复用 EtymologyCard
 * - Layer 2: AI Context (Async, Streaming) -> 虚线边框 + 呼吸动画
 */
export function WandContent({ data, isAILoading = false, className }: WandContentProps) {
    const { vocab, etymology, ai_insight } = data;

    // 适配 EtymologyCard 所需的类型 (Etymology Prisma Model)
    // 注意: API 返回的是部分字段，这里进行类型断言适配
    // 只要 EtymologyCard 只使用 mode, memory_hook, data 字段即可安全工作
    const etymologyAdapter = etymology ? {
        id: "adapter",
        vocabId: 0,
        mode: etymology.mode,
        memory_hook: etymology.memory_hook,
        data: etymology.data,
        source: "adapter",
        updatedAt: new Date(),
        createdAt: new Date()
    } as any : null;

    return (
        <div className={cn("flex flex-col gap-6 pb-8", className)}>
            {/* 0. Header: Definition */}
            <div className="flex items-center gap-3 px-2">
                <span className="font-serif text-lg font-bold text-indigo-600 dark:text-indigo-400">{vocab.meaning}</span>
            </div>

            {/* Layer 1: Source Code (词根拆解) */}
            {etymologyAdapter && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">词源拆解</span>
                    </div>
                    <EtymologyCard etymology={etymologyAdapter} className="px-0 py-0" />
                </div>
            )}

            {/* Layer 2: AI Context (虚线边框) */}
            <section className="px-1">
                <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isAILoading ? "bg-indigo-500 animate-pulse" : "bg-indigo-500"
                    )} />
                    <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        AI 情境分析
                        {isAILoading && <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />}
                    </h3>
                </div>

                <div className={cn(
                    "rounded-xl border-2 border-dashed p-5 transition-all duration-500",
                    isAILoading
                        ? "border-indigo-200/50 dark:border-indigo-800/50 bg-indigo-50/10 dark:bg-indigo-900/10"
                        : "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 shadow-sm"
                )}>
                    {ai_insight ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95">
                            {/* Collocation */}
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase text-zinc-400 font-mono font-bold tracking-wider">常见搭配</span>
                                <p className="text-sm font-serif font-medium text-zinc-800 dark:text-zinc-200">
                                    {ai_insight.collocation}
                                </p>
                            </div>

                            {/* Nuance */}
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase text-zinc-400 font-mono font-bold tracking-wider">语气与细微差别</span>
                                <p className="text-xs font-serif text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    {ai_insight.nuance}
                                </p>
                            </div>

                            {/* Example (Nullable) */}
                            {ai_insight.example && (
                                <div className="pt-2 border-t border-indigo-100 dark:border-indigo-800 mt-2">
                                    <p className="font-serif italic text-zinc-500 dark:text-zinc-400 text-sm">
                                        "{ai_insight.example}"
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : isAILoading ? (
                        // Skeleton: 正在加载
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800" />
                            </div>
                            <Skeleton className="h-16 w-full bg-zinc-50 dark:bg-zinc-800" />
                            <div className="flex items-center gap-2 pt-2">
                                <Sparkles className="w-3 h-3 text-rose-300" />
                                <span className="text-xs text-zinc-400">正在分析上下文...</span>
                            </div>
                        </div>
                    ) : (
                        // Empty State: 加载完成但无数据
                        <div className="py-4 text-center">
                            <p className="text-xs text-zinc-400 italic">暂无情境分析数据</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
