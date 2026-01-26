"use client";

import { cn } from "@/lib/utils";

interface PhraseCardProps {
    phraseMarkdown: string; // The phrase with **target** word
    translation: string;
    wordDefinition: string;
    phonetic?: string;
    partOfSpeech?: string;
    status: "idle" | "correct" | "wrong" | "revealed"; // Reusing status
}

export function PhraseCard({
    phraseMarkdown,
    translation,
    wordDefinition,
    phonetic,
    partOfSpeech,
    status
}: PhraseCardProps) {

    // Helper to render markdown-like bold with the specific new style
    const renderContent = (md: string) => {
        const parts = (md || "").split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                const text = part.slice(2, -2);
                // Matched Snippet: Highlighting Style
                // Using inline-block to allow vertical padding/badges
                return (
                    <span key={i} className="relative inline-block mx-1">
                        <span className="relative z-10 px-3 py-1 rounded-lg bg-violet-500/20 text-violet-300 border-b-2 border-violet-500/50 font-bold shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                            {text}
                        </span>
                        {/* Phonetic floating above if available? Or keep it simple. User snippet shows phonetic floating above. */}
                        {phonetic && (
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-violet-400 whitespace-nowrap opacity-80">
                                {phonetic}
                            </span>
                        )}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const isRevealed = status !== "idle";

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-lg text-center space-y-8">

                {/* 1. Stimulus (Phrase) */}
                {/* Matched Snippet: font-serif, text-zinc-300 */}
                <h2 className="font-serif text-3xl md:text-4xl leading-relaxed text-zinc-300">
                    {renderContent(phraseMarkdown)}
                </h2>

                {/* 2. Feedback (Revealed) */}
                <div className={cn(
                    "space-y-4 transition-all duration-500 ease-out overflow-hidden relative",
                    isRevealed ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : "hidden"
                )}>
                    {/* Translation */}
                    <p className="text-xl text-white font-medium">
                        {translation}
                    </p>

                    {/* Definition Badge */}
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mt-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase bg-zinc-800 px-1.5 py-0.5 rounded">
                            {partOfSpeech || 'WORD'}
                        </span>
                        <span className="text-sm text-zinc-300">
                            {wordDefinition}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}
