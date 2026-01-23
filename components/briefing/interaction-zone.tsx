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
}

export function InteractionZone({ task, onComplete }: InteractionZoneProps) {
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

        // Trigger callback after visual feedback (e.g. 1s)
        setTimeout(() => {
            onComplete(isCorrect);
            // Reset local state if parent doesn't unmount?
            // Usually parent moves to next card, re-mounting this component or changing key.
        }, 1500);
    };

    return (
        <div className="w-full space-y-6 pt-4">
            {/* Question Text */}
            <h3 className="text-xl font-medium text-center leading-relaxed">
                {task.question_markdown.split('_______').map((part, i, arr) => (
                    <span key={i}>
                        {part}
                        {i < arr.length - 1 && (
                            <span className="inline-block border-b-2 border-primary w-16 mx-1 text-center font-bold text-primary">
                                {submitted && selected}
                            </span>
                        )}
                    </span>
                ))}
            </h3>

            {/* Options - We treat swipe_card and bubble_select similarly for now using Badges */}
            <div className="flex flex-wrap gap-3 justify-center">
                {task.options.map((opt) => {
                    const isSelected = selected === opt;
                    const isCorrect = opt === task.answer_key;

                    let variant: "outline" | "default" | "destructive" | "secondary" = "outline";
                    if (submitted) {
                        if (isSelected && isCorrect) variant = "default"; // Greenish? Default is Primary (Indigo)
                        else if (isSelected && !isCorrect) variant = "destructive";
                        else if (!isSelected && isCorrect) variant = "secondary"; // Show correct answer
                    } else {
                        variant = isSelected ? "default" : "outline"; // Hover/Active state
                    }

                    // Custom styles for success state if needed
                    const successClass = (submitted && isCorrect && isSelected) ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-500" : "";
                    const correctHintClass = (submitted && isCorrect && !isSelected) ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "";

                    return (
                        <Badge
                            key={opt}
                            variant={variant}
                            className={cn(
                                "text-lg py-2 px-6 cursor-pointer hover:scale-105 transition-all active:scale-95 select-none",
                                successClass,
                                correctHintClass
                            )}
                            onClick={() => handleSelect(opt)}
                        >
                            {opt}
                            {submitted && isSelected && (
                                isCorrect
                                    ? <CheckCircle2 className="w-4 h-4 ml-2" />
                                    : <XCircle className="w-4 h-4 ml-2" />
                            )}
                        </Badge>
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
