"use client";

import { cn } from "@/lib/utils";
import { stripBold, hasBold } from "@/lib/utils/markdown";
import { useTTS } from "@/hooks/use-tts"; // Re-added for H1 interaction
import { TTSButton } from "@/components/tts/tts-button";
import { EtymologyCard } from "@/components/vocab/EtymologyCard"; // [New]

interface PhraseCardProps {
    phraseMarkdown: string;
    translation: string;
    wordDefinition: string;
    phonetic?: string;
    partOfSpeech?: string;
    status: "idle" | "correct" | "wrong" | "revealed";
    targetWord?: string;
    etymology?: any; // [New]
}

export function PhraseCard({
    phraseMarkdown,
    translation,
    wordDefinition,
    phonetic,
    partOfSpeech,
    status,
    targetWord,
    etymology // [New]
}: PhraseCardProps) {

    // Smart Highlight Logic matching Demo Style (Tilted + Indigo)
    const renderSmartText = (text: string) => {
        // [P0] Chunk Tag Processing (L1 意群断句)
        // 先检查是否包含 <chunk> 标签
        if (text.includes('<chunk>')) {
            const chunkRegex = /(<chunk>.*?<\/chunk>)/g;
            const parts = text.split(chunkRegex);

            return parts.map((part, i) => {
                if (part.startsWith('<chunk>') && part.endsWith('</chunk>')) {
                    const innerContent = part.replace(/<\/?chunk>/g, '');
                    // 递归处理内部内容（可能包含 **bold** 或 targetWord）
                    return (
                        <span key={i} className="inline-block bg-cyan-500/10 px-2 py-0.5 rounded-lg border-b-2 border-cyan-500/50 mx-0.5">
                            {renderInnerHighlight(innerContent)}
                        </span>
                    );
                }
                // 非 chunk 部分也需要处理高亮
                return <span key={i}>{renderInnerHighlight(part)}</span>;
            });
        }

        // Fallback: 没有 chunk 标签，使用原有逻辑
        return renderInnerHighlight(text);
    };

    // Inner highlight logic (handles **bold** and targetWord)
    const renderInnerHighlight = (text: string) => {
        let regex: RegExp;
        let isMarkdown = false;

        // 1. Markdown Check (using utility)
        if (hasBold(text)) {
            regex = /(\*\*.*?\*\*)/g;
            isMarkdown = true;
        }
        // 2. Smart Target Match Check
        else if (targetWord) {
            const safeTarget = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`\\b(${safeTarget}(?:s|es|d|ed|ing)?)\\b`, 'gi');
            isMarkdown = false;
        }
        // 3. Fallback
        else {
            return text;
        }

        const parts = text.split(regex);

        return parts.map((part, i) => {
            let isHighlight = false;
            let content = part;

            if (isMarkdown) {
                if (part.startsWith('**') && part.endsWith('**')) {
                    isHighlight = true;
                    content = part.slice(2, -2);
                }
            } else {
                if (regex.test(part)) {
                    isHighlight = true;
                }
            }

            if (isHighlight) {
                // Demo Style: Tilted BG + Indigo Text
                return (
                    <span key={i} className="relative inline-block mx-1 group cursor-help select-none">
                        <span className="absolute inset-0 bg-indigo-100 -rotate-2 rounded-lg scale-110 group-hover:bg-indigo-200 transition-colors"></span>
                        <span className="relative z-10 text-indigo-700 font-bold px-1">
                            {content}
                        </span>
                    </span>
                );
            }

            // Default Text: Strong, Dark Zinc (Demo Style)
            return <span key={i} className="text-zinc-800 dark:text-zinc-200 transition-colors">{part}</span>;
        });
    }

    // Translation Highlight Logic 
    // Tries to highlight keys from definition in translation
    const renderTranslation = (transText: string) => {
        if (!wordDefinition) return <span className="text-zinc-500 dark:text-zinc-400 font-medium">{transText}</span>;

        // Clean definition: "n. 接受；验收" -> "接受" (take first)
        const cleanDef = wordDefinition.replace(/^\[.*?\]\s*/, "").replace(/^[a-z]+\.\s*/, "");
        const keywords = cleanDef.split(/[,;，；\s]+/).filter(k => k.length > 1);

        const hit = keywords.find(k => transText.includes(k));

        if (hit) {
            const parts = transText.split(hit);
            return (
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                    {parts.map((p, i) => (
                        <span key={i}>
                            {p}
                            {i < parts.length - 1 && (
                                <span className="text-indigo-500 dark:text-indigo-400 font-bold mx-1">
                                    {hit}
                                </span>
                            )}
                        </span>
                    ))}
                </span>
            )
        }

        return <span className="text-zinc-500 dark:text-zinc-400 font-medium">{transText}</span>;
    }

    const showFeedback = status !== "idle" && status !== "wrong" && status !== "correct";
    const isRevealed = status !== "idle";

    // Sentence TTS Logic
    const { play: playSentence, isPlaying: isSentencePlaying } = useTTS();
    const handlePlaySentence = () => {
        const cleanText = stripBold(phraseMarkdown); // Strip markdown using utility
        playSentence({
            text: cleanText,
            // Use defaults (Voice: Cherry, Speed: 1.0)
        });
    };

    return (
        <div className="w-full h-full flex flex-col justify-between relative">

            {/* 1. Content Area (Variable Height) */}
            <div className="flex-1 flex flex-col justify-center w-full">
                {/* Removed px-6 (handled by wrapper) */}

                {/* Tag */}
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <span className="px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest shadow-sm">
                        Business • Phrase
                    </span>
                </div>

                {/* Main Sentence - Click to Play */}
                <h1
                    onClick={handlePlaySentence}
                    className={cn(
                        "font-serif text-[22px] md:text-3xl leading-relaxed text-left text-zinc-800 dark:text-zinc-100 animate-in fade-in duration-500 cursor-pointer hover:opacity-70 active:scale-[0.99] transition-all origin-left select-none",
                        isSentencePlaying && "text-indigo-600 dark:text-indigo-400"
                    )}
                >
                    {renderSmartText(phraseMarkdown)}
                </h1>

                {/* Translation - Explicitly Rendered */}
                <div className={cn(
                    "mt-6 transition-all duration-700 ease-out text-left",
                    isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}>
                    <p className="text-xl text-zinc-500 dark:text-zinc-400 font-sans font-medium leading-relaxed">
                        {renderTranslation(translation || "暂无翻译")}
                    </p>
                </div>

            </div>

            {/* 2. Definition Block (Bottom Anchored) */}
            <div className={cn(
                "w-full flex-shrink-0 transition-all duration-700 delay-100 pt-12 pb-2", // Reduced pb-12 to pb-2 (wrapper has padding)
                isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
            )}>
                <div className="flex flex-col items-center gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-8 w-full max-w-sm mx-auto">

                    {/* Phonetic & Audio Row */}
                    <div className="flex items-center gap-3 text-zinc-400">
                        {phonetic && <span className="font-mono text-lg tracking-wide">/{phonetic.replace(/\//g, '')}/</span>}
                        <TTSButton
                            text={targetWord || ""}
                            voice="Cherry"
                            className="bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-500 rounded-full w-9 h-9"
                        />
                    </div>

                    {/* Definition Text Row (With Markdown Support) */}
                    <div className="text-zinc-600 dark:text-zinc-300 text-base font-medium text-center leading-relaxed">
                        {partOfSpeech && <span className="italic mr-2 text-zinc-400 font-serif">{partOfSpeech}</span>}
                        {renderSmartText(wordDefinition || "")}
                    </div>
                    {/* Etymology Module */}
                    {isRevealed && etymology && (
                        <div className="w-full mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 px-6">
                            <EtymologyCard etymology={etymology} variant="minimal" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
