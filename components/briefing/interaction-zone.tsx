'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InteractionTask {
    style: 'swipe_card' | 'bubble_select';
    question_markdown: string;
    options: string[];
    answer_key: string;
    explanation_markdown?: string; // Revealed after
}

interface InteractionZoneProps {
    task: InteractionTask;
    onComplete: (isCorrect: boolean) => void;
    onAnswer?: (isCorrect: boolean) => void;
}

export function InteractionZone({ task, onComplete, onAnswer }: InteractionZoneProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    // Parse Question: "The manager _______ the budget."
    // We want to render the hole?
    // Or just display question text.

    const handleSelect = (option: string) => {
        if (submitted) return;
        setSelected(option);
        setSubmitted(true);

        // Immediate Feedback delay or direct?
        // User wants "Safety". Maybe immediate show result.
        // Call parent after short delay?
        const isCorrect = option === task.answer_key;

        // Notify parent immediately for visual reveal
        if (onAnswer) {
            onAnswer(isCorrect);
        }

        // Trigger callback after visual feedback (e.g. 1s)
        setTimeout(() => {
            onComplete(isCorrect);
            // Reset local state if parent doesn't unmount?
            // Usually parent moves to next card, re-mounting this component or changing key.
        }, 1500);
    };

    return (
        <div className="w-full space-y-8 pt-8 px-2 max-w-2xl mx-auto">
            {/* Question Text */}
            <div className="relative group">
                <h3 className="text-2xl font-bold text-center leading-relaxed tracking-tight px-4">
                    {task.question_markdown.split('_______').map((part, i, arr) => (
                        <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                                <span className={cn(
                                    "inline-flex items-center justify-center min-w-[100px] border-b-4 mx-2 transition-all duration-300 h-10",
                                    submitted ? "border-primary/20 text-primary scale-105" : "border-primary/50 animate-pulse"
                                )}>
                                    {submitted ? selected : "?"}
                                </span>
                            )}
                        </span>
                    ))}
                </h3>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {task.options.map((opt) => {
                    const isSelected = selected === opt;
                    const isCorrect = opt === task.answer_key;

                    let variantClass = "bg-card hover:bg-accent border-border";
                    if (submitted) {
                        if (isSelected && isCorrect) variantClass = "bg-emerald-500 text-white border-emerald-500 ring-4 ring-emerald-500/20";
                        else if (isSelected && !isCorrect) variantClass = "bg-destructive text-destructive-foreground border-destructive ring-4 ring-destructive/20";
                        else if (!isSelected && isCorrect) variantClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
                        else variantClass = "opacity-40 grayscale-[0.5]";
                    } else {
                        if (isSelected) variantClass = "bg-primary text-primary-foreground border-primary shadow-lg ring-4 ring-primary/20 -translate-y-1";
                    }

                    return (
                        <button
                            key={opt}
                            disabled={submitted}
                            className={cn(
                                "relative flex items-center justify-between p-4 rounded-2xl border-2 font-bold text-lg transition-all duration-300 active:scale-[0.98] group",
                                variantClass
                            )}
                            onClick={() => handleSelect(opt)}
                        >
                            <span className="flex-1 text-center">{opt}</span>
                            <div className="absolute right-4">
                                {submitted && isSelected && (
                                    isCorrect
                                        ? <CheckCircle2 className="w-6 h-6 animate-in zoom-in" />
                                        : <XCircle className="w-6 h-6 animate-in zoom-in" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Explanation Reveal */}
            <AnimatePresence>
                {submitted && task.explanation_markdown && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground border border-border/50 text-center"
                    >
                        {task.explanation_markdown}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
