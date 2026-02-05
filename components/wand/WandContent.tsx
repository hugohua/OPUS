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
            {/* 0. Header: Word & Definition */}
            <div className="flex items-baseline gap-4 px-2">
                <h2 className="text-3xl font-black text-zinc-900 tracking-tight">
                    {/* 这个组件通常由外部传入 word，但这里可以做一个备用显示 */}
                    {/* 实际通常在上层 SheetHeader 显示单词 */}
                </h2>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-zinc-400">/{vocab.phonetic}/</span>
                    <span className="text-lg font-bold text-indigo-600">{vocab.meaning}</span>
                </div>
            </div>

            {/* Layer 1: Local DNA (实线边框) */}
            {etymologyAdapter && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <EtymologyCard etymology={etymologyAdapter} className="px-0 py-0" />
                </div>
            )}

            {/* Layer 2: AI Context (虚线边框) */}
            <section className="px-1">
                <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isAILoading ? "bg-rose-500 animate-pulse" : "bg-rose-500"
                    )}></div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        AI Context Layer
                        {isAILoading && <Activity className="w-3 h-3 text-rose-400 animate-pulse" />}
                    </h3>
                </div>

                <div className={cn(
                    "rounded-xl border-2 border-dashed p-5 transition-all duration-500",
                    isAILoading
                        ? "border-rose-200/50 bg-rose-50/10"
                        : "border-rose-200 bg-white shadow-sm"
                )}>
                    {ai_insight ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95">
                            {/* Collocation */}
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase text-zinc-400 font-bold">Collocation</span>
                                <p className="text-sm font-medium text-zinc-800">
                                    {ai_insight.collocation}
                                </p>
                            </div>

                            {/* Nuance */}
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase text-zinc-400 font-bold">Nuance</span>
                                <p className="text-xs text-zinc-600 leading-relaxed">
                                    {ai_insight.nuance}
                                </p>
                            </div>

                            {/* Example (Nullable) */}
                            {ai_insight.example && (
                                <div className="pt-2 border-t border-rose-100 mt-2">
                                    <p className="font-serif italic text-zinc-500 text-sm">
                                        "{ai_insight.example}"
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Skeleton Logic
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-3/4 bg-zinc-100" />
                            </div>
                            <Skeleton className="h-16 w-full bg-zinc-50" />
                            <div className="flex items-center gap-2 pt-2">
                                <Sparkles className="w-3 h-3 text-rose-300" />
                                <span className="text-xs text-zinc-400">Analyzing context...</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
