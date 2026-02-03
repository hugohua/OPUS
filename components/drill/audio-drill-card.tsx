"use client";

import React, { useState } from "react";
import { UniversalCard } from "@/components/drill/universal-card";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Eye, Check, X as XIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioDrillCardProps {
    vocab: {
        word: string;
        phonetic?: string;
        definition?: string;
    };
    isPlaying: boolean;
    onPlay: () => void;
    onReveal: () => void;
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    progress: number;
    onExit: () => void;
}

type AudioState = "listening" | "recall" | "reveal";

export function AudioDrillCard({
    vocab,
    isPlaying,
    onPlay,
    onReveal,
    onGrade,
    progress,
    onExit
}: AudioDrillCardProps) {
    const [state, setState] = useState<AudioState>("listening");

    // 状态机逻辑
    const handleReveal = () => {
        setState("reveal");
        onReveal();
    };

    const handleGrade = (grade: 1 | 2 | 3 | 4) => {
        // 重置状态为下一次循环准备 (由父组件控制数据更新)
        onGrade(grade);
        setState("listening");
    };

    /**
     * ZONE A: Stimulus (Audio Waveform / Word Reveal)
     */
    const ZoneA = (
        <div className="flex flex-col items-center justify-center gap-8 w-full">

            {/* 1. Audio Visualizer (Waveform Placeholder) */}
            <motion.div
                className="relative w-32 h-32 flex items-center justify-center"
                animate={{ scale: isPlaying ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: isPlaying ? Infinity : 0, duration: 1.5 }}
            >
                {/* Outward Ripples */}
                {isPlaying && (
                    <>
                        <div className="absolute inset-0 bg-violet-500/20 rounded-full animate-ping" />
                        <div className="absolute inset-0 bg-violet-500/10 rounded-full animate-ping delay-75" />
                    </>
                )}

                {/* Main Play Button (Tap to Replay) */}
                <button
                    onClick={onPlay}
                    className="relative z-10 w-20 h-20 bg-violet-600 rounded-full flex items-center justify-center shadow-xl shadow-violet-500/30 text-white active:scale-95 transition-transform"
                >
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </button>
            </motion.div>

            {/* 2. Hidden Content (Eyes-Free until Reveal) */}
            <AnimatePresence mode="wait">
                {state === "reveal" ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center space-y-2"
                    >
                        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {vocab.word}
                        </h1>
                        <p className="text-lg font-mono text-zinc-400">
                            /{vocab.phonetic || ""}/
                        </p>
                        {vocab.definition && (
                            <p className="text-sm text-zinc-500 mt-2 max-w-[200px] mx-auto line-clamp-2">
                                {vocab.definition}
                            </p>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-24 flex items-center justify-center"
                    >
                        <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest animate-pulse">
                            Listening Mode
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );

    /**
     * ZONE B: Interaction (Footer Controls)
     */
    const ZoneB = (
        <div className="w-full grid gap-4">
            {state !== "reveal" ? (
                // RECALL PHASE: Reveal Button + Replay
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={handleReveal}
                        className="h-14 w-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 rounded-2xl font-semibold text-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Eye className="w-5 h-5" />
                        Reveal
                    </button>
                </div>
            ) : (
                // REVEAL PHASE: Grading (Implicit or Explicit? PRD asks for Implicit based on time, but explicit 1/3/5 buttons are safer for MVP)
                // Integrating "Implicit Grading" concept: 
                // Just "Got it" (Pass) vs "Forgot" (Fail). Simple binary choice + system calculates time.
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleGrade(1)} // Fail (Again)
                        className="h-16 w-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1"
                    >
                        <RotateCcw className="w-6 h-6" />
                        <span className="text-xs uppercase tracking-wider">Forgot</span>
                    </button>

                    <button
                        onClick={() => handleGrade(3)} // Pass (Good) -> Code can calc time-based 3 vs 4
                        className="h-16 w-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl font-bold text-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1"
                    >
                        <Check className="w-6 h-6" />
                        <span className="text-xs uppercase tracking-wider">Got it</span>
                    </button>

                    {/* Easy Button (Hidden or strictly for expert users? Let's stick to 2-button flow for simplicity per PRD) */}
                </div>
            )}
        </div>
    );

    return (
        <UniversalCard
            variant="violet"
            category="AUDIO GYM"
            progress={progress}
            onExit={onExit}
            footer={ZoneB}
            clean // Use transparent background for floating/modern feel
        >
            {ZoneA}
        </UniversalCard>
    );
}
