/**
 * AudioScriptDrill - Focus Shell Implementation
 * 
 * Major Refactor:
 * - Uses FocusShell for layout (L1 Cyan).
 * - Moves Options to ControlDeck (Footer).
 * - transforms Feedback Overlay into Inline Stage content.
 */

"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BriefingPayload, TextSegment, InteractionSegment } from "@/types/briefing";
import paper from "canvas-confetti";
import { FocusShell } from "@/components/drill/focus-shell";
import { ControlDeck, ControlDeckMode } from "@/components/drill/control-deck";
import { motion, AnimatePresence } from "framer-motion";
import { boldToHtml } from "@/lib/utils/markdown";
import { useRouter } from "next/navigation";

interface AudioScriptDrillProps {
    drill: BriefingPayload;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    onNext?: () => void;
    index?: number;
    total?: number;
}

// Type Guard
function isAudioTask(task: any): boolean {
    return task && typeof task.answer_key === 'string' && Array.isArray(task.options);
}

export function AudioScriptDrill({
    drill,
    isPlaying,
    onTogglePlay,
    onGrade,
    index = 1,
    total = 20
}: AudioScriptDrillProps) {
    const router = useRouter();
    const [status, setStatus] = useState<"listening" | "revealed">("listening");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Data Extraction
    const textSegment = drill.segments.find((s): s is TextSegment => s.type === 'text');
    let rawScript = textSegment?.audio_text || textSegment?.content_markdown || "";
    const segment = drill.segments.find((s): s is InteractionSegment => s.type === 'interaction');
    const task = segment?.task && isAudioTask(segment.task) ? segment.task : null;

    useEffect(() => {
        setStatus("listening");
        setSelectedOption(null);
    }, [drill]);

    if (!task) return <div className="p-4 text-rose-500">Invalid Task Data</div>;

    const answerKey = task.answer_key;
    const options = task.options || [];

    // Normalization
    const normalize = (s: string) => s?.trim().toLowerCase() || "";

    // Handlers
    const handleDeckAction = (action: string) => {
        if (status === 'listening') {
            // Options Mode: 1, 2, 3, 4
            if (['1', '2', '3', '4'].includes(action)) {
                const idx = parseInt(action) - 1;
                const opt = options[idx];
                if (opt) {
                    const optText = typeof opt === 'string' ? opt : opt.text;
                    const optKey = typeof opt === 'string' ? opt : opt.id || opt.text; // Use ID if available, else Text

                    setSelectedOption(optKey);
                    setStatus('revealed');

                    // Confetti if correct
                    if (normalize(optKey) === normalize(answerKey)) {
                        paper({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                    }
                }
            } else if (action === 'reveal') {
                // Fallback or "Don't Know" -> Reveal directly? 
                // Current ControlDeck logic for 'options' mode doesn't show Reveal button.
                // Maybe mapped to Space? Space -> Reveal?
                // Let's allow Space to Reveal (Give Up)
                setSelectedOption('GIVE_UP');
                setStatus('revealed');
            }
        } else {
            // Grade Mode
            if (['1', '2', '3', '4'].includes(action)) {
                onGrade(parseInt(action) as any);
            }
        }
    };

    // Derived State
    const deckMode: ControlDeckMode = status === 'listening' ? 'options' : 'grade';
    const progress = ((index) / total) * 100;

    // Process Script & Analysis
    const finalScript = rawScript.replace(/<[^>]+>/g, '');
    const explanation = task?.explanation;
    const finalAnalysis = explanation?.correct_logic || "";
    const phonetic = textSegment?.phonetic || explanation?.phonetic || "";
    const getDefinition = () => explanation?.definition_cn || (drill.meta as any).definition_cn || "";

    // Prepare Option Labels for ControlDeck
    const optionLabels: any = {};
    options.forEach((opt: any, i: number) => {
        optionLabels[String(i + 1)] = typeof opt === 'string' ? opt : opt.text;
    });

    return (
        <FocusShell
            variant="L1" // Cyan for Listening
            label="L1 • LISTENING"
            progress={progress}
            onExit={() => router.push('/dashboard')}
            footer={
                <ControlDeck
                    mode={deckMode}
                    onAction={handleDeckAction}
                    labels={deckMode === 'options' ? optionLabels : {}}
                />
            }
        >
            <div className="w-full flex-1 flex flex-col items-center justify-center gap-8 py-4">

                {/* 1. Visualizer (Always Visible, maybe shrinks on reveal) */}
                <div
                    onClick={onTogglePlay}
                    className="flex items-center gap-1.5 h-24 cursor-pointer hover:opacity-80 transition-opacity"
                >
                    {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                            key={i}
                            animate={isPlaying ? { height: [24, 48 + Math.random() * 32, 24] } : { height: 24 }}
                            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                            className={cn(
                                "w-2 rounded-full",
                                status === 'revealed' ? "bg-zinc-300 dark:bg-zinc-700" : "bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                            )}
                        />
                    ))}
                </div>

                {/* 2. Content Area (Switch between Question and Script) */}
                <AnimatePresence mode="wait">
                    {status === 'listening' ? (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-center space-y-4 max-w-sm"
                        >
                            <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500 tracking-widest">
                                听力辨析
                            </p>
                            <h2 className="font-serif text-2xl text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                你听到了什么？
                            </h2>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="script"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-md space-y-6"
                        >
                            {/* Result Badge */}
                            <div className="flex justify-center">
                                {(() => {
                                    const isGivenUp = selectedOption === 'GIVE_UP';
                                    const isCorrect = !isGivenUp && normalize(selectedOption || "") === normalize(answerKey);
                                    return (
                                        <div className={cn(
                                            "px-4 py-1.5 rounded-full text-xs font-bold font-mono tracking-wider uppercase border",
                                            isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                                                "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400"
                                        )}>
                                            {isCorrect ? "正确" : isGivenUp ? "跳过" : "错误"}
                                        </div>
                                    )
                                })()}
                            </div>

                            {/* Script Box */}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider">目标单词</span>
                                            <span className="text-xs font-serif italic text-zinc-500">{phonetic}</span>
                                        </div>
                                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{drill.meta.target_word}</p>
                                    </div>

                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                                    <div>
                                        <span className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider mb-1 block">语境</span>
                                        <div
                                            className="text-base text-zinc-600 dark:text-zinc-300 font-serif leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: boldToHtml(finalScript, "text-cyan-600 dark:text-cyan-400 font-bold") }}
                                        />
                                    </div>

                                    {finalAnalysis && (
                                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans mt-2">
                                            <span className="font-bold text-cyan-600 text-xs mr-2">解析</span>
                                            {finalAnalysis}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </FocusShell>
    );
}
