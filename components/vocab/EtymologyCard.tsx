import React from "react";
import { Etymology, EtymologyMode } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * 词源展示组件 (Morphology IDE Style)
 */
interface EtymologyCardProps {
    etymology: Etymology | null;
    className?: string;
    variant?: 'default' | 'minimal';
}

export function EtymologyCard({ etymology, className, variant = 'default' }: EtymologyCardProps) {
    if (!etymology || etymology.mode === "NONE") return null;

    const data = etymology.data as any;
    const parts = data.roots || data.components;
    const hasVisuals = Array.isArray(parts) && parts.length > 0;
    const logicText = etymology.memory_hook || data.logic_cn;

    const isMinimal = variant === 'minimal';

    const content = (
        <div className={cn(
            "relative p-4 rounded-xl overflow-hidden group shadow-sm border",
            "bg-white dark:bg-zinc-900/60 dark:backdrop-blur-xl border-zinc-200/80 dark:border-white/15 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
        )}>
            {/* 左侧状态指示线 */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-400/40 dark:bg-indigo-500/40 group-hover:bg-indigo-500 transition-colors"></div>

            {/* 标题头 (IDE Console Style) */}
            <div className="flex items-center gap-1.5 mb-4 text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest pl-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Morphology (词根推导)
            </div>

            {/* 词法解析区 (Tokenizer) */}
            {hasVisuals && (
                <div className="flex flex-wrap items-center gap-2 pl-1 mb-3">
                    {parts.map((part: any, index: number) => (
                        <React.Fragment key={index}>
                            {/* 操作符 */}
                            {index > 0 && <span className="text-zinc-300 dark:text-zinc-600 font-mono text-sm">+</span>}
                            {/* Token */}
                            {renderToken(part.part, part.meaning_cn)}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* 推导结果 (Return Statement) */}
            {logicText && (
                <div className={cn("pl-1 flex items-start gap-2 mt-1", hasVisuals && "pt-3 border-t border-zinc-200/60 dark:border-white/10")}>
                    <div className="mt-0.5 text-indigo-400 dark:text-indigo-500">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-snug">
                        {renderLogicReturn(logicText)}
                    </div>
                </div>
            )}

            {/* 树状关联 (Tree) - 可选 */}
            {data.related && data.related.length > 0 && !isMinimal && (
                <div className="pl-1 mt-4 flex items-baseline gap-2 pt-3 border-t border-zinc-200/60 dark:border-white/10">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Tree:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {data.related.map((word: string) => (
                            <span key={word} className="px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 text-[10px] font-mono hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm">
                                {word.replace(/ /g, '_')}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    if (isMinimal) {
        return (
            <div className={cn("relative w-full font-sans", className)}>
                {content}
            </div>
        );
    }

    // Default Full Mode (Word Detail Page Style)
    return (
        <section className={cn("px-6 py-4", className)}>
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Source Code
                </h3>
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                <span className="text-[9px] text-zinc-300 dark:text-zinc-600 font-mono">
                    {etymology.mode}
                </span>
            </div>
            {content}
        </section>
    );
}

function renderToken(part: string, meaning: string) {
    if (!part) return null;
    let type = 'root';
    if (part.endsWith('-')) {
        type = 'prefix';
    } else if (part.startsWith('-')) {
        type = 'suffix';
    }

    if (type === 'prefix') {
        return (
            <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-500/20">
                    {part}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{meaning}</span>
            </div>
        );
    } else if (type === 'suffix') {
        return (
            <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-sm font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-white/5">
                    {part}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">{meaning}</span>
            </div>
        );
    } else {
        return (
            <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-white/10 shadow-sm">
                    {part}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{meaning}</span>
            </div>
        );
    }
}

function renderLogicReturn(text: string) {
    if (!text) return null;
    const parts = text.split(/(?:->|=>|→)/);
    if (parts.length > 1) {
        return (
            <>
                {parts[0].trim()}
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600 font-mono">{"->"}</span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{parts.slice(1).join("->").trim()}</strong>
            </>
        );
    }
    return <span className="text-zinc-900 dark:text-zinc-100">{text}</span>;
}
