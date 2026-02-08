"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BriefingPayload } from "@/types/briefing";
import paper from "canvas-confetti";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradingHelp } from "./grading-help";
import { boldToHtml } from "@/lib/utils/markdown";

interface AudioScriptDrillProps {
    drill: BriefingPayload;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    onNext?: () => void;
    index?: number;
    total?: number;
}

// Define types for Audio Task
interface AudioTask {
    style: "swipe_card" | "bubble_select";
    question_markdown: string;
    options: (string | { id: string; text: string })[];
    answer_key: string;
    explanation?: {
        correct_logic?: string;
        definition_cn?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export function AudioScriptDrill({
    drill,
    isPlaying,
    onTogglePlay,
    onGrade,
    index = 1,
    total = 20
}: AudioScriptDrillProps) {
    const [status, setStatus] = useState<"listening" | "revealed">("listening");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const segment = drill.segments.find(s => s.type === 'interaction');
    // Assert task type
    const task = segment?.task as unknown as AudioTask;
    const answerKey = task?.answer_key;
    const options = task?.options || [];

    useEffect(() => {
        setStatus("listening");
        setSelectedOption(null);
    }, [drill]);

    const handleSelect = (option: string) => {
        if (status === "revealed") return;

        setSelectedOption(option);
        setStatus("revealed");

        const isCorrect = option === answerKey;
        if (isCorrect) {
            paper({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    };

    const targetWord = drill.meta.target_word;
    const explanation = task?.explanation;

    // Correctly extract audio script using audio_text priority and strip XML tags
    const textSegment = drill.segments.find(s => s.type === 'text');
    let rawScript = (textSegment as any)?.audio_text || textSegment?.content_markdown || "";

    // 1. Strip XML
    rawScript = rawScript.replace(/<[^>]+>/g, '').trim();

    // 2. Handle "Analysis:" merge (Fallback if backend sends merged text)
    let finalScript = rawScript;
    let fallbackAnalysis = "";

    // Remove leading "Script:" label if present
    if (finalScript.match(/^(Script:|脚本:)/i)) {
        finalScript = finalScript.replace(/^(Script:|脚本:)\s*/i, '');
    }

    // Split Analysis/Explanation if merged
    const splitMatch = finalScript.match(/(Analysis:|解析:|Explanation:)/i);
    if (splitMatch && splitMatch.index !== undefined) {
        fallbackAnalysis = finalScript.substring(splitMatch.index + splitMatch[0].length).trim();
        finalScript = finalScript.substring(0, splitMatch.index).trim();
    }

    const finalAnalysis = explanation?.correct_logic || fallbackAnalysis;

    const phonetic = (textSegment as any)?.phonetic;

    const getDefinition = () => {
        if (['string', 'undefined'].includes(typeof explanation)) return "";
        return explanation?.definition_cn || "";
    };

    return (
        <div className="relative w-full h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased overflow-hidden flex flex-col selection:bg-brand-core/30">

            {/* Ambient Background - Dark Mode "Deep Space" ONLY */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#22d3ee05_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee05_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none hidden dark:block"></div>
            <div className="absolute top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none hidden dark:block"></div>

            {/* Header */}
            <header className="absolute top-0 w-full z-50 px-6 py-6 flex justify-between items-center opacity-80">
                <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-cyan-500", isPlaying ? "animate-pulse" : "")}></div>
                    <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-500 uppercase tracking-widest">LIVE AUDIO</span>
                </div>
                <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-full px-3 py-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                    {String(index).padStart(2, '0')} / {total}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-md mx-auto">

                {/* Visualizer */}
                <div
                    className="relative flex items-center justify-center h-40 w-full mb-12 cursor-pointer group"
                    onClick={onTogglePlay}
                >
                    <div className={cn(
                        "absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full transition-transform duration-1000",
                        isPlaying ? "scale-75" : "scale-50"
                    )}></div>

                    {isPlaying ? (
                        <div className="flex items-center gap-1.5 h-20">
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-8 animate-[music_1.2s_ease-in-out_infinite]"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-12 animate-[music_0.8s_ease-in-out_infinite] delay-75"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-16 animate-[music_1.5s_ease-in-out_infinite] delay-150"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-10 animate-[music_1.0s_ease-in-out_infinite] delay-300"></div>
                            <div className="w-1.5 bg-cyan-500 dark:bg-cyan-300 rounded-full h-20 animate-[music_1.3s_ease-in-out_infinite] delay-75 shadow-[0_0_15px_#22d3ee]"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-14 animate-[music_0.9s_ease-in-out_infinite] delay-200"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-8 animate-[music_1.1s_ease-in-out_infinite] delay-100"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-4 animate-[music_1.4s_ease-in-out_infinite] delay-500"></div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 h-20 opacity-30">
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-4"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-8"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-12"></div>
                            <div className="w-1.5 bg-cyan-500 dark:bg-cyan-300 rounded-full h-6"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-10"></div>
                            <div className="w-1.5 bg-cyan-600 dark:bg-cyan-400 rounded-full h-5"></div>
                        </div>
                    )}

                    <div className={cn(
                        "absolute -bottom-12 text-[10px] font-mono text-cyan-600/50 dark:text-cyan-500/50 uppercase tracking-[0.2em]",
                        isPlaying ? "animate-pulse" : ""
                    )}>
                        {isPlaying ? "Listening..." : "Paused"}
                    </div>
                </div>

                {/* Interaction Options */}
                <div className="w-full px-6 space-y-4 animate-in slide-in-from-bottom-8 duration-700 fade-in">
                    {options.map((opt: any, idx: number) => {
                        const label = String.fromCharCode(65 + idx);
                        const text = typeof opt === 'string' ? opt : opt.text;
                        const key = typeof opt === 'string' ? opt : opt.id || text;

                        return (
                            <button
                                key={idx}
                                onClick={() => handleSelect(key)}
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-cyan-500/30 active:scale-[0.98] transition-all group text-left backdrop-blur-sm shadow-sm dark:shadow-none"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500 group-hover:border-cyan-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-500">
                                        {label}
                                    </div>
                                    <span className="text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 font-medium">{text}</span>
                                </div>
                            </button>
                        );
                    })}

                    <Button
                        variant="ghost"
                        onClick={() => { setSelectedOption('GIVE_UP'); setStatus('revealed'); }}
                        className="w-full text-zinc-400 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 h-10 font-mono text-xs"
                    >
                        [ REVEAL ]
                    </Button>
                </div>

            </main>

            {/* Reveal Overlay */}
            {status === "revealed" && (
                <div className="absolute inset-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl flex flex-col pt-24 pb-12 px-6 animate-in fade-in duration-300">


                    <div className="flex-1 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1 h-8 mb-8 opacity-50 cursor-pointer" onClick={onTogglePlay}>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-4", isPlaying && "animate-pulse")}></div>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-8", isPlaying && "animate-pulse")}></div>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-5", isPlaying && "animate-pulse")}></div>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-sans font-bold text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">{targetWord}</h1>
                        <p className="text-xl font-mono text-zinc-400 dark:text-zinc-500 mb-8">{phonetic || ""}</p>

                        <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 max-w-sm w-full text-left space-y-4">

                            {/* Script Section */}
                            <div>
                                <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Script</span>
                                <div className="text-lg text-zinc-700 dark:text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: boldToHtml(finalScript, "text-cyan-600 dark:text-cyan-400 font-bold") }}
                                />
                            </div>

                            {/* Analysis Section (If exists) */}
                            {finalAnalysis && (
                                <div className="pt-4 border-t border-zinc-200 dark:border-white/5">
                                    <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-500 uppercase tracking-wider block mb-1">Analysis</span>
                                    <div className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans"
                                        dangerouslySetInnerHTML={{ __html: boldToHtml(finalAnalysis, "text-cyan-600 dark:text-cyan-400 font-bold") }}
                                    />
                                </div>
                            )}

                            {/* Definition Section (If exists) */}
                            {getDefinition() && (
                                <div className="pt-4 border-t border-zinc-200 dark:border-white/5">
                                    <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Meaning</span>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {getDefinition()}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grading Buttons - FSRS */}
                    <div className="w-full flex justify-between items-center px-1 mb-3 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest opacity-70">Rate Accuracy</span>
                        <GradingHelp />
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-auto">
                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(1)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-400 border-2">
                                <RotateCcw className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Again</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(2)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-2">
                                <span className="font-bold">2</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Hard</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(3)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-2">
                                <span className="font-bold">3</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Good</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(4)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-cyan-200 dark:border-cyan-900/30 text-cyan-600 dark:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:text-cyan-700 dark:hover:text-cyan-400 border-2">
                                <span className="font-bold">4</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Easy</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
