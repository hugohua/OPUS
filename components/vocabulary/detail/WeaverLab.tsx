'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Mail, Megaphone, Loader2 } from "lucide-react";
import { WeaverFlavor } from "@/lib/generators/l3/weaver-generator";
import { cn } from "@/lib/utils";
import { boldToHtml } from "@/lib/utils/markdown";
import { getWeaverAnchor } from "@/actions/weaver-actions";

interface WeaverLabProps {
    targetWord: string;
    vocabId: number;
}

// Extract story and translation from Markdown format
// Format: "Story text\n---\nTranslation text"
const extractContent = (text: string) => {
    const parts = text.split('---');

    if (parts.length >= 2) {
        return {
            story: parts[0].trim(),
            translation: parts[1].trim()
        };
    }

    // Fallback
    return {
        story: text.trim(),
        translation: ""
    };
};

const FLAVORS: { id: WeaverFlavor; label: string; icon: any }[] = [
    { id: "gossip", label: "Gossip", icon: MessageSquare },
    { id: "email", label: "Email", icon: Mail },
    { id: "public", label: "Public", icon: Megaphone },
];

export function WeaverLab({ targetWord, vocabId }: WeaverLabProps) {
    const [activeFlavor, setActiveFlavor] = useState<WeaverFlavor>("gossip");
    const [anchorMeta, setAnchorMeta] = useState<{ word: string; scenario: string } | null>(null);
    const [isExploding, setIsExploding] = useState(false);
    const [isSearchingAnchor, setIsSearchingAnchor] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<Record<string, string>>({});
    const [activeStreamFlavor, setActiveStreamFlavor] = useState<WeaverFlavor | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Derivations
    const currentContent = history[activeFlavor] || "";
    const isCurrentLoading = isLoading && activeStreamFlavor === activeFlavor;
    const { story, translation } = extractContent(currentContent);

    const handleWeave = async () => {
        setIsSearchingAnchor(true);
        setError(null);
        setActiveStreamFlavor(activeFlavor);

        try {
            // Step 1: Get Anchor
            const anchor = await getWeaverAnchor(vocabId);
            setAnchorMeta({
                word: anchor.word,
                scenario: anchor.scenario || "General"
            });
            setIsExploding(true);
            setTimeout(() => setIsExploding(false), 2000);
            setIsSearchingAnchor(false);

            // Step 2: Stream from API
            setIsLoading(true);

            // Initialize history for this flavor to empty string to trigger UI switch
            setHistory(prev => ({ ...prev, [activeFlavor]: "" }));
            const response = await fetch("/api/weaver/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetId: vocabId,
                    flavor: activeFlavor,
                    anchorWord: anchor.word,
                    anchorScenario: anchor.scenario
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            // Parse tuoye-style SSE format
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            if (!reader) {
                throw new Error("No reader available");
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (!data) continue;

                        try {
                            const parsed = JSON.parse(data);

                            switch (parsed.type) {
                                case 'content':
                                    setHistory(prev => ({
                                        ...prev,
                                        [activeFlavor]: (prev[activeFlavor] || "") + parsed.data
                                    }));
                                    break;

                                case 'done':
                                    console.log("[WeaverLab] Stream completed");
                                    break;

                                case 'error':
                                    throw new Error(parsed.error);

                                default:
                                    console.warn("[WeaverLab] Unknown SSE type:", parsed.type);
                            }
                        } catch (e) {
                            console.warn("[WeaverLab] Failed to parse SSE:", data, e);
                        }
                    }
                }
            }

        } catch (err) {
            console.error("[WeaverLab] Error:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
            setIsSearchingAnchor(false);
            setActiveStreamFlavor(null);
        }
    };



    // const { story, translation } = extractContent(streamedText); // Moved to derivation

    return (
        <section className="mb-24 px-6">
            <div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-violet-600/20 to-amber-500/20 group overflow-hidden">
                <div className="relative bg-white dark:bg-zinc-950 rounded-2xl p-5 min-h-[200px] flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <Sparkles className="w-4 h-4 fill-current" />
                            </div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                                Weaver Lab
                            </h3>
                        </div>

                        <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-lg p-1">
                            {FLAVORS.map(flavor => {
                                const Icon = flavor.icon;
                                const isActive = activeFlavor === flavor.id;
                                const hasData = !!history[flavor.id];

                                return (
                                    <button
                                        key={flavor.id}
                                        onClick={() => setActiveFlavor(flavor.id)}
                                        disabled={isLoading}
                                        className={cn(
                                            "p-2 rounded-md transition-all relative flex items-center gap-1.5",
                                            isActive
                                                ? "bg-white dark:bg-zinc-800 text-violet-600 shadow-sm"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                                            isLoading && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {/* Status Dot */}
                                        {hasData && !isActive && (
                                            <span className="w-1 h-1 rounded-full bg-violet-500/50" />
                                        )}
                                        {isActive && (
                                            <motion.span
                                                layoutId="active-flavor"
                                                className="absolute inset-0 border-2 border-transparent rounded-md"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stage */}
                    <div className="flex-1 flex flex-col items-center justify-center relative min-h-[120px]">

                        {/* Idle */}
                        {!currentContent && !isCurrentLoading && !isSearchingAnchor && (
                            <div className="text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                <p className="text-xs text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                                    Generate a <strong className="text-zinc-900 dark:text-zinc-100 font-medium">{activeFlavor}</strong> scenario weaving
                                    <strong className="text-violet-600 font-bold ml-1">{targetWord}</strong>.
                                </p>
                                <button
                                    onClick={handleWeave}
                                    className="h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-full shadow-lg shadow-violet-500/20 active:scale-95 transition-all flex items-center gap-2 mx-auto"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>Weave {activeFlavor}</span>
                                </button>
                            </div>
                        )}

                        {/* Loading */}
                        {(isSearchingAnchor || (isCurrentLoading && !story)) && (
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                                <span className="text-xs text-zinc-400 font-mono tracking-widest uppercase">
                                    {isSearchingAnchor ? "Calculating Vectors..." : "Weaving Story..."}
                                </span>
                            </div>
                        )}

                        {/* Result */}
                        {(story || currentContent) && !isSearchingAnchor && (
                            <div className="w-full text-left animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* Anchor Badge */}
                                <div className="flex items-center gap-2 mb-4 justify-center">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-full">
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold font-mono tracking-tight uppercase">
                                            ANCHOR:
                                        </span>
                                        <span className="text-xs text-amber-700 dark:text-amber-300 font-bold font-serif">
                                            {anchorMeta?.word || "..."}
                                        </span>
                                    </div>
                                    {anchorMeta && (
                                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                                            • {anchorMeta.scenario}
                                        </span>
                                    )}
                                </div>

                                <div className="prose prose-sm dark:prose-invert font-serif leading-loose text-zinc-800 dark:text-zinc-200 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 rounded-xl border border-zinc-100 dark:border-zinc-808/50 shadow-sm">
                                    <p dangerouslySetInnerHTML={{
                                        __html: (story || currentContent)
                                            // Highlight Target (Violet Chip)
                                            .replace(
                                                new RegExp(`\\*\\*${targetWord}\\*\\*`, 'gi'),
                                                `<span class="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md font-bold mx-0.5 shadow-sm border border-violet-200/50 dark:border-violet-700/50">${targetWord}</span>`
                                            )
                                            // Highlight Anchor (Amber Chip)
                                            .replace(
                                                new RegExp(`\\*\\*${anchorMeta?.word}\\*\\*`, 'gi'),
                                                `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-bold mx-0.5 shadow-sm border border-amber-200/50 dark:border-amber-700/50">${anchorMeta?.word}</span>`
                                            )
                                    }} />

                                    {/* Translation */}
                                    {translation && (
                                        <div className="mt-4 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50">
                                            <p
                                                className="text-xs text-zinc-500 dark:text-zinc-400 italic leading-relaxed"
                                                dangerouslySetInnerHTML={{
                                                    __html: boldToHtml(translation, 'text-indigo-600 dark:text-indigo-400 font-bold not-italic bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded mx-0.5')
                                                }}
                                            />
                                        </div>
                                    )}

                                    {isCurrentLoading && (
                                        <span className="inline-block w-1.5 h-4 bg-violet-600 animate-pulse ml-1 align-middle rounded-full"></span>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="text-red-500 text-xs mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <strong>Error:</strong> {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
