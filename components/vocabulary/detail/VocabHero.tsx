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
    rank?: number | null;
    derivatives?: any; // JSON
    synonyms?: string[];
}

export function VocabHero({ word, phonetic, definition, rank, derivatives, synonyms }: VocabHeroProps) {
    const tts = useTTS();

    const handlePlay = () => {
        tts.play({
            text: word,
            voice: "Cherry", // Default voice
            language: "en-US",
            speed: 1.0
        });
    };

    // Rank styling logic
    const isCore = (rank || 9999) < 3000;

    return (
        <section className="text-center flex flex-col items-center mb-10 animate-in fade-in zoom-in-95 duration-500 mt-6">


            {/* Word Title */}
            <h1 className="font-serif text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 mb-2 tracking-tight">
                {word}
            </h1>

            {/* Phonetic & Audio */}
            <div className="flex items-center gap-3 mb-6">
                <span className="font-mono text-zinc-400 text-lg">/{phonetic || "..."}/</span>
                <Button
                    onClick={handlePlay}
                    disabled={tts.isLoading}
                    size="icon"
                    className="rounded-full bg-violet-600/20 text-violet-400 hover:bg-violet-600 hover:text-white border-0 w-8 h-8 shadow-none"
                >
                    {tts.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 fill-current" />
                    )}
                </Button>
            </div>

            {/* Definition Card */}
            <div className="bg-white/50 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] rounded-2xl p-4 w-full max-w-sm">
                <p className="text-lg text-zinc-700 dark:text-zinc-100 font-medium leading-relaxed">
                    {/* Assume definition contains part of speech prefix or just text */}
                    {/* For now simplified rendering */}
                    <span className="text-zinc-900 dark:text-zinc-100">{definition || "暂无释义"}</span>
                </p>

                {/* Derivatives / Word Family */}
                {/* Derivatives / Word Family */}
                {/* Derivatives / Word Family */}
                {derivatives && (
                    // Filter out empty values first
                    (() => {
                        const validDerivatives = Object.entries(derivatives).filter(([_, val]) => val && String(val).trim() !== '');

                        if (validDerivatives.length === 0) return null;

                        return (
                            <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-white/10 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 font-mono text-left">
                                {validDerivatives.map(([pos, val]: [string, any]) => (
                                    <div key={pos} className="flex gap-1 truncate">
                                        <span className="font-bold text-zinc-400 dark:text-zinc-600 w-8 shrink-0 text-right">{pos}.</span>
                                        <span className="text-zinc-700 dark:text-zinc-300 truncate" title={String(val)}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })()
                )}

                {/* Thesaurus Bar (Synonyms Only) */}
                {synonyms && synonyms.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide justify-center">
                        <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-600 font-bold tracking-wider pt-0.5">Syn:</span>
                        {synonyms.slice(0, 3).map(syn => (
                            <span key={syn} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
                                {syn}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
