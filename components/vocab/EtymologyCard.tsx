
import { Etymology, EtymologyMode } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * 词源展示组件 (Source Code)
 * 
 * 根据 mode 渲染不同的布局:
 * - ROOTS: 词根拆解 (root + prefix + suffix)
 * - COMPOUND: 合成词 (component + component)
 * - STORY: 故事模式 (文本描述)
 */

interface EtymologyCardProps {
    etymology: Etymology | null;
    className?: string;
}

export function EtymologyCard({ etymology, className }: EtymologyCardProps) {
    if (!etymology || etymology.mode === "NONE") return null;

    const data = etymology.data as any; // Cast JSON to any for flexible access
    const isRoots = etymology.mode === "ROOTS";
    const hasVisuals = Array.isArray(data.roots) && data.roots.length > 0;

    // Demo Style Implementation
    return (
        <section className={cn("px-6 py-4", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                    Source Code (Etymology)
                </h3>
                <div className="h-px flex-1 bg-zinc-100"></div>
                {etymology.mode !== 'NONE' && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 text-zinc-400 rounded border border-zinc-200 font-mono">
                        {etymology.mode}
                    </span>
                )}
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 relative overflow-hidden">

                {/* 1. Visual Breakdown (For Roots & Others if available) */}
                {hasVisuals && (
                    <div className="flex flex-wrap items-center gap-3 mb-3 font-mono text-sm">
                        {renderComponents(etymology.mode, data)}
                    </div>
                )}

                {/* 2. Logic / Memory Hook */}
                <div className="flex gap-3 pl-1 border-l-2 border-indigo-100">
                    <div className="text-xs text-zinc-500 leading-relaxed font-mono">
                        <span className="text-indigo-500 font-bold">// Logic:</span>
                        {" "}{etymology.memory_hook || data.logic_cn || "No logic provided."}
                    </div>
                </div>

                {/* 3. Tree / Origin Info */}
                <div className="mt-3 flex items-center gap-2">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">Tree:</span>
                    {/* Render Related Words or Origin */}
                    {isRoots && data.related?.map((word: string) => (
                        <span key={word} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded border border-zinc-200 font-mono">
                            {word}
                        </span>
                    ))}
                    {!isRoots && data.origin_word && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded border border-zinc-200 font-mono">
                            {data.origin_word} ({data.origin_lang})
                        </span>
                    )}
                </div>

            </div>
        </section>
    );
}

// Helper to render "part + part" logic
function renderComponents(mode: EtymologyMode, data: any) {
    // New prompt only uses "roots", but we keep "components" fallback just in case
    const parts = data.roots || data.components;
    if (!parts || !Array.isArray(parts)) return null;

    return parts.map((part: { part: string; meaning_cn: string }, index: number) => (
        <div key={index} className="flex flex-wrap items-center gap-3">
            {/* Separator */}
            {index > 0 && <span className="text-zinc-300">+</span>}

            <div className="flex flex-col items-center group">
                <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 font-bold shadow-sm">
                    {part.part.replace(/-/g, '')}
                </span>
                <span className="text-[9px] text-zinc-400 mt-1">{part.meaning_cn}</span>
            </div>
        </div>
    ));
}
