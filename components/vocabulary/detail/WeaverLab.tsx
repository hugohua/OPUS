'use client';

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface WeaverLabProps {
    targetWord: string;
    budgetWord: string; // Random word from review queue
}

export function WeaverLab({ targetWord, budgetWord }: WeaverLabProps) {
    const [isWeaving, setIsWeaving] = useState(false);
    const [story, setStory] = useState<string | null>(null);

    const handleWeave = async () => {
        setIsWeaving(true);
        // Mock Latency for Streaming UI simulation
        await new Promise(r => setTimeout(r, 2500));

        setStory(`The marketing manager needed a new **${targetWord}** because the project went over **${budgetWord}**. It was a disaster.`);
        setIsWeaving(false);
    };

    return (
        <section className="mb-24 px-1"> {/* Extra margin bottom for scroll */}
            <div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-amber-400/50 to-violet-600/50 group overflow-hidden">

                <div className="relative bg-white dark:bg-zinc-950 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-violet-600 flex items-center justify-center text-white">
                            <Sparkles className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                            Weaver Lab
                        </h3>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                        Connect <span className="text-zinc-900 dark:text-white font-bold">{targetWord}</span> with a random word from your review queue.
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-mono text-zinc-600 dark:text-zinc-500">{budgetWord}</span>
                        </div>
                        <div className="text-zinc-400 dark:text-zinc-600">+</div>
                        <button
                            onClick={handleWeave}
                            disabled={isWeaving}
                            className="flex-1 h-10 bg-zinc-900 text-white dark:bg-white dark:text-black font-bold text-xs rounded-lg hover:bg-zinc-800 dark:hover:bg-violet-50 transition-colors flex items-center justify-center gap-2 shadow-lg dark:shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isWeaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Weaving...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Weave Story</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Result Area */}
                    {story && (
                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 animate-in slide-in-from-top-2">
                            <p className="text-sm text-zinc-700 dark:text-zinc-200 italic leading-relaxed font-serif">
                                {/* Render story with simple highlighting */}
                                <span dangerouslySetInnerHTML={{
                                    __html: story
                                        .replace(`**${targetWord}**`, `<span class="text-zinc-900 dark:text-white font-bold">${targetWord}</span>`)
                                        .replace(`**${budgetWord}**`, `<span class="text-violet-600 dark:text-violet-400 font-bold">${budgetWord}</span>`)
                                }} />
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
