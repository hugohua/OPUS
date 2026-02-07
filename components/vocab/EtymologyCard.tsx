import React from "react";
import { Etymology, EtymologyMode } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * 词源展示组件 (Source Code)
 */
interface EtymologyCardProps {
    etymology: Etymology | null;
    className?: string;
    variant?: 'default' | 'minimal'; // [New]
}

export function EtymologyCard({ etymology, className, variant = 'default' }: EtymologyCardProps) {
    if (!etymology || etymology.mode === "NONE") return null;

    const data = etymology.data as any;
    const hasVisuals = Array.isArray(data.roots) && data.roots.length > 0;

    // Minimal Mode: Show ONLY the logic line
    if (variant === 'minimal') {
        return (
            <div className={cn("w-full pl-3 border-l-2 border-indigo-300 bg-indigo-50/50 py-2 pr-2 rounded-r select-text", className)}>
                <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-2">// Logic:</span>
                    {etymology.memory_hook || data.logic_cn}
                </p>
            </div>
        );
    }

    // Default Full Mode
    return (
        <section className={cn("px-6 py-2", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Source Code
                </h3>
                <span className="text-[10px] text-zinc-400 font-mono ml-auto">
                    {etymology.mode}
                </span>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 relative overflow-hidden">

                {/* 1. Visual Breakdown (AST Style) */}
                {hasVisuals && (
                    <div className="flex items-center justify-center gap-4 mb-4 font-mono">
                        {renderComponents(etymology.mode, data)}
                    </div>
                )}

                {/* 2. Logic / Memory Hook (Comment Style) */}
                <div className="pl-2 border-l-2 border-indigo-200 bg-indigo-50/50 py-2 pr-2 rounded-r">
                    <p className="font-mono text-xs text-zinc-600 leading-relaxed">
                        <span className="text-indigo-500 font-bold mr-1">// Logic:</span>
                        {etymology.memory_hook || data.logic_cn}
                    </p>
                </div>

                {/* 3. Tree / Related (Array Style) */}
                {data.related && data.related.length > 0 && (
                    <div className="mt-4 flex items-baseline gap-2 pt-3 border-t border-zinc-200/60">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Tree:</span>
                        <div className="flex flex-wrap gap-1.5">
                            {data.related.map((word: string) => (
                                <span key={word} className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-600 text-[10px] font-mono hover:bg-zinc-50 transition-colors">
                                    {word.replace(/ /g, '_')}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

// Helper to render "part + part" logic (AST Nodes)
function renderComponents(mode: EtymologyMode, data: any) {
    const parts = data.roots || data.components;
    if (!parts || !Array.isArray(parts)) return null;

    return parts.map((part: { part: string; meaning_cn: string }, index: number) => (
        <React.Fragment key={index}>
            {/* Operator Node */}
            {index > 0 && <span className="text-zinc-300 text-lg font-light select-none">+</span>}

            {/* Value Node */}
            <div className="flex flex-col items-center group">
                <span className="px-3 py-1 bg-white border border-zinc-300 rounded text-zinc-800 font-bold shadow-sm min-w-[32px] text-center">
                    {part.part.replace(/-/g, '')}
                </span>
                <span className="text-[9px] text-zinc-400 mt-1 font-medium">{part.meaning_cn}</span>
            </div>
        </React.Fragment>
    ));
}
