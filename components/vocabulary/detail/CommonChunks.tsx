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
                ? <span key={i} className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline decoration-indigo-300 underline-offset-2 transition-colors">{part}</span>
                : part
        );
    };

    // Limit to 4 items for cleaner UI
    const displayCollocations = collocations.slice(0, 4);

    if (!displayCollocations.length) return null;


    return (
        <section className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Common Chunks</h3>
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
            </div>

            <div className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
                {displayCollocations.map((col, idx) => (
                    <div
                        key={idx}
                        onClick={() => handlePlay(col.text)}
                        className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex justify-between items-center group cursor-pointer"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {highlightWord(col.text, mainWord)}
                            </div>
                            {col.trans && (
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                    {col.trans}
                                </span>
                            )}
                        </div>

                        {/* Mock Frequency Badge for first item */}
                        {idx === 0 && (
                            <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[9px] font-mono text-zinc-400 dark:text-zinc-500 shrink-0">
                                HI
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
