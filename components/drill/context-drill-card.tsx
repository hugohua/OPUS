/**
 * ContextDrillCard - Focus Shell Implementation
 */

"use client";

import React, { useState, useMemo, useRef, useEffect, useOptimistic, startTransition } from "react";
import { FocusShell } from "@/components/drill/focus-shell";
import { ControlDeck, ControlDeckMode } from "@/components/drill/control-deck";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lightbulb, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { BriefingPayload } from "@/types/briefing";
import { calculateImplicitGrade } from "@/lib/algorithm/grading";
import { boldToHtml } from "@/lib/utils/markdown";

interface ContextDrillCardProps {
    drill: BriefingPayload;
    progress: number;
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    onExit: () => void;
}

type ContextState = "reading" | "answered" | "socratic";

export function ContextDrillCard({
    drill,
    progress,
    onGrade,
    onExit
}: ContextDrillCardProps) {
    const [state, setState] = useState<ContextState>("reading");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);

    const [optimisticProgress, setOptimisticProgress] = useOptimistic(
        progress,
        (current, amount: number) => Math.min(100, current + amount)
    );

    const startTimeRef = useRef<number>(Date.now());
    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [drill]);

    const textSegment = drill.segments.find(s => s.type === "text");
    const interactionSegment = drill.segments.find(s => s.type === "interaction");
    const task = interactionSegment?.task;
    const options = task?.options || [];
    const correctAnswer = task?.answer_key || "";
    const explanation = task?.explanation_markdown || "";
    const socraticHint = task?.socraticHint || "Look at the context clues around the blank.";

    const articleContent = useMemo(() => {
        const content = textSegment?.content_markdown || "";
        return content.replace(/\[___\]/g, "______");
    }, [textSegment]);

    if (options.length === 0) {
        return (
            <FocusShell variant="L2" progress={optimisticProgress} onExit={onExit} footer={<div />}>
                <div className="text-center text-zinc-500 py-8">
                    <p>No options available. Please try again.</p>
                </div>
            </FocusShell>
        );
    }

    // Logic
    const handleDeckAction = (action: string) => {
        if (state === "reading" || state === "socratic") {
            // Option Selection
            if (['1', '2', '3', '4'].includes(action)) {
                const idx = parseInt(action) - 1;
                const option = options[idx];
                if (option) {
                    setSelectedOption(option);
                    if (option === correctAnswer) {
                        setState("answered");
                        setShowAnswer(true);
                    } else {
                        setState("socratic");
                    }
                }
            }
        } else if (state === "answered") {
            // Grading
            if (action === '1') handleGrade(1); // Hard
            if (action === '2') handleGrade(3); // Got it
        }
    };

    const handleRetry = () => {
        setSelectedOption(null);
        setState("reading");
    };

    const handleGrade = (inputGrade: 1 | 3) => {
        const duration = Date.now() - startTimeRef.current;
        const implicitGrade = calculateImplicitGrade(inputGrade, duration, false, 'CONTEXT');

        startTransition(() => {
            setOptimisticProgress(5);
            onGrade(implicitGrade as 1 | 2 | 3 | 4);
        });

        setState("reading");
        setSelectedOption(null);
        setShowAnswer(false);
    };

    // Control Deck Config
    const deckMode: ControlDeckMode = state === "answered" ? "binary" : "options";
    const optionLabels: any = {};
    if (deckMode === 'options') {
        options.forEach((opt: string, i: number) => {
            optionLabels[String(i + 1)] = opt;
        });
    }

    return (
        <FocusShell
            variant="L2" // Violet
            label="L2 • CONTEXT"
            progress={optimisticProgress}
            onExit={onExit}
            footer={
                <ControlDeck
                    mode={deckMode}
                    onAction={handleDeckAction}
                    labels={
                        deckMode === 'binary'
                            ? { '1': 'Hard', '2': 'Got it' }
                            : optionLabels
                    }
                />
            }
        >
            <div className="flex flex-col w-full max-w-lg space-y-6 pt-4">

                {/* Article Container */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                    {/* Format Badge */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
                            {drill.meta.format || "EMAIL"}
                        </span>
                        {drill.meta.target_word && (
                            <span className="text-xs text-zinc-400 font-mono">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{drill.meta.target_word}</span>
                            </span>
                        )}
                    </div>

                    {/* Article Text */}
                    <div className="font-serif text-lg leading-loose text-zinc-800 dark:text-zinc-200 whitespace-pre-line">
                        {articleContent.split("______").map((part, idx, arr) => (
                            <React.Fragment key={idx}>
                                {part}
                                {idx < arr.length - 1 && (
                                    <span className={cn(
                                        "inline-block min-w-[60px] mx-1 border-b-2 text-center font-sans font-bold px-1 transition-colors duration-300",
                                        showAnswer
                                            ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-t"
                                            : state === 'socratic'
                                                ? "border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                                : "border-indigo-200 text-transparent"
                                    )}>
                                        {showAnswer ? correctAnswer : (state === 'socratic' && selectedOption) ? selectedOption : "?"}
                                    </span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Socratic / Explanation Area */}
                <AnimatePresence mode="wait">
                    {showAnswer && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800"
                        >
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                                <Check className="w-4 h-4" />
                                <span className="font-bold text-xs uppercase tracking-wider">Correct</span>
                            </div>
                            <p
                                className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans"
                                dangerouslySetInnerHTML={{ __html: boldToHtml(explanation) }}
                            />
                        </motion.div>
                    )}

                    {state === "socratic" && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 relative group cursor-pointer"
                            onClick={handleRetry}
                        >
                            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                                <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4" />
                                    <span className="font-bold text-xs uppercase tracking-wider">Hint</span>
                                </div>
                                <span className="text-[10px] font-mono opacity-60 flex items-center gap-1 group-hover:underline">
                                    <RotateCcw className="w-3 h-3" /> Retry
                                </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 italic leading-relaxed font-serif">
                                "{socraticHint}"
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </FocusShell>
    );
}
