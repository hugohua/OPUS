'use client';

import { useTTS } from "@/hooks/use-tts";
import { Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VocabHeroProps {
    word: string;
    phonetic?: string | null;
    definition: string | null;
    definitions?: any; // JSON { business_cn, general_cn }
    rank?: number | null;
    derivatives?: any; // JSON
    synonyms?: string[];
    id?: number; // Add ID prop
}

export function VocabHero({ word, phonetic, definition, definitions, rank, derivatives, synonyms, id }: VocabHeroProps) {
    const tts = useTTS();

    const handlePlay = () => {
        tts.play({
            text: word,
            voice: "Cherry", // Default voice
            language: "en-US",
            speed: 1.0
        });
    };

    // Parse structured definitions
    const structDef = definitions && typeof definitions === 'object' ? definitions : null;
    const businessDef = structDef?.business_cn;
    const generalDef = structDef?.general_cn;

    // Rank Logic
    const isCore = (rank || 9999) < 3000;

    return (
        <section className="px-6 pt-8 pb-6 border-b border-zinc-100 dark:border-zinc-900">

            {/* Top Meta Row */}
            <div className="flex items-center justify-between mb-2">
                <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase",
                    isCore
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                )}>
                    {isCore ? "#Core" : "#Word"} {rank ? `Top ${rank}` : ""}
                </span>
                <span className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600">ID: {id || "---"}</span>
            </div>

            {/* Word Row */}
            <div className="flex items-center justify-between mb-1">
                <h1 className="font-serif text-5xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {word}
                </h1>
                <button
                    onClick={handlePlay}
                    className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all active:scale-95"
                >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                </button>
            </div>

            {/* Phonetic */}
            <div className="text-base font-mono text-zinc-400 mb-6 tracking-wide">
                /{phonetic?.replace(/^\/+|\/+$/g, '') || "..."}/
            </div>

            {/* Definitions Block */}
            <div className="flex flex-col gap-4 mb-6">
                {(businessDef || generalDef) ? (
                    <>
                        {businessDef && (
                            <div className="flex items-start gap-3 group">
                                <span className="mt-0.5 px-1.5 py-0.5 rounded-[4px] bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shrink-0 select-none">
                                    BIZ
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200 leading-none">{businessDef}</span>
                                    {/* Placeholder for EN definition if we had it */}
                                    {/* <span className="text-sm text-zinc-400 font-medium mt-1">...</span> */}
                                </div>
                            </div>
                        )}
                        {generalDef && generalDef !== businessDef && (
                            <div className="flex items-start gap-3 group">
                                <span className="mt-0.5 px-1.5 py-0.5 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 select-none">
                                    GEN
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200 leading-none">{generalDef}</span>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Fallback */
                    <div className="flex items-start gap-3 group">
                        <span className="mt-0.5 px-1.5 py-0.5 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 select-none">
                            DEF
                        </span>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200 leading-none">{definition || "..."}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Synonyms Pills */}
            {synonyms && synonyms.length > 0 && (
                <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">SYN:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {synonyms.slice(0, 5).map(syn => (
                            <a
                                key={syn}
                                href={`/dashboard/vocab/${syn}`}
                                className="px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 font-mono hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            >
                                {syn}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
