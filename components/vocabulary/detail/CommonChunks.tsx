'use client';

import { useTTS } from "@/hooks/use-tts";
import { cn } from "@/lib/utils";

interface Collocation {
    text: string;
    trans?: string;
}

interface CommonChunksProps {
    collocations: Collocation[];
    mainWord: string;
}

export function CommonChunks({ collocations, mainWord }: CommonChunksProps) {
    const tts = useTTS();

    const handlePlay = (text: string) => {
        tts.play({
            text: text,
            voice: "Cherry",
            language: "en-US",
            speed: 1.0
        });
    };

    // Helper to highlight the main word
    const highlightWord = (phrase: string, word: string) => {
        const parts = phrase.split(new RegExp(`(${word})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === word.toLowerCase()
                ? <span key={i} className="text-violet-600 dark:text-violet-400 font-bold group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">{part}</span>
                : part
        );
    };

    return (
        <section className="mb-8 px-1">
            <h3 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3 pl-1">
                L0 • Common Chunks
            </h3>
            <div className="flex flex-wrap gap-2">
                {collocations.map((col, idx) => (
                    <button
                        key={idx}
                        onClick={() => handlePlay(col.text)}
                        className={cn(
                            "px-3 py-2 rounded-lg text-xs transition-all text-left group flex flex-col gap-0.5",
                            "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800",
                            "text-zinc-700 dark:text-zinc-300",
                            "hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                        )}
                    >
                        <span>{highlightWord(col.text, mainWord)}</span>
                        {col.trans && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                                {col.trans}
                            </span>
                        )}
                    </button>
                ))}
                {collocations.length === 0 && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-600 italic pl-1">No collocations available.</span>
                )}
            </div>
        </section>
    );
}
