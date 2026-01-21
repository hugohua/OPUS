'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, useSpring, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X, ChevronLeft, ChevronRight, Hand } from 'lucide-react';
import type { BriefingPayload } from '@/lib/validations/briefing';

// ============================================
// Types
// ============================================

type InteractionTask = Extract<BriefingPayload['segments'][number], { type: 'interaction' }>['task'];

interface InteractionZoneProps {
    task: InteractionTask;
    onComplete: (isCorrect: boolean) => void;
    className?: string;
}

// ============================================
// Sub-component: SwipeChoice
// ============================================

interface SwipeChoiceProps {
    options: string[];
    answerKey: string;
    questionMarkdown: string;
    onComplete: (isCorrect: boolean) => void;
}

const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 800; // Trigger on fast flick

function SwipeChoice({ options, answerKey, questionMarkdown, onComplete }: SwipeChoiceProps) {
    const leftOption = options[0];
    const rightOption = options[1] || options[0];

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]); // Add subtle rotation

    // Smooth opacity for labels on the card
    const leftOpacity = useTransform(x, [-100, -20], [1, 0]);
    const rightOpacity = useTransform(x, [20, 100], [0, 1]);

    // Background color shifts
    const bgOpacity = useTransform(x, [-150, 0, 150], [0.1, 0, 0.1]);
    const borderLeftColor = useTransform(x, [-100, 0], ['rgba(16, 185, 129, 1)', 'rgba(16, 185, 129, 0)']); // Tailwind Emerald-500
    const borderRightColor = useTransform(x, [0, 100], ['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 1)']); // Tailwind Blue-500

    const containerRef = useRef<HTMLDivElement>(null);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        // Check Trigger Conditions
        if (offset < -SWIPE_THRESHOLD || velocity < -SWIPE_VELOCITY) {
            handleSelection(leftOption);
        } else if (offset > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
            handleSelection(rightOption);
        } else {
            // Spring back via layout animation automatically (dragSnapToOrigin)
        }
    };

    const handleSelection = (selectedOption: string) => {
        const isCorrect = selectedOption === answerKey;
        onComplete(isCorrect);
    };

    return (
        <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Validated Question Container with shrink-0 */}
            <div className="mb-4 text-center px-4 shrink-0 z-10">
                <p className="text-xl font-medium leading-relaxed text-foreground">
                    {questionMarkdown}
                </p>
            </div>

            {/* The Draggable Card - Safe Height & No Aspect Ratio dependency for heavy squeeze */}
            <motion.div
                drag="x"
                dragConstraints={containerRef} // Allow movement within container
                dragSnapToOrigin={true} // Automatic spring back
                dragElastic={0.6} // iOS Standard Rubber Banding
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }} // Snappy return
                style={{ x, rotate }}
                onDragEnd={handleDragEnd}
                className="relative z-20 w-full max-w-sm h-80 min-h-[320px] bg-card border border-border rounded-2xl shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
                whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Visual Feedback Overlays on Card */}
                {/* Left Choice Indicator (Now Green/Emerald for "Choice A" instead of danger) */}
                <motion.div
                    style={{ opacity: leftOpacity }}
                    className="absolute right-6 top-6 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-200 px-4 py-2 rounded-lg font-bold border border-emerald-200 dark:border-emerald-800 pointer-events-none"
                >
                    {leftOption}
                </motion.div>

                {/* Right Choice Indicator */}
                <motion.div
                    style={{ opacity: rightOpacity }}
                    className="absolute left-6 top-6 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-200 px-4 py-2 rounded-lg font-bold border border-blue-200 dark:border-blue-800 pointer-events-none"
                >
                    {rightOption}
                </motion.div>

                <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                    <Hand className="w-8 h-8" strokeWidth={1.5} />
                    <span className="text-sm font-medium">Drag to decide</span>
                </div>

                {/* Glowing Border Feedback */}
                <motion.div style={{ borderColor: borderLeftColor }} className="absolute inset-0 border-4 rounded-2xl border-transparent pointer-events-none" />
                <motion.div style={{ borderColor: borderRightColor }} className="absolute inset-0 border-4 rounded-2xl border-transparent pointer-events-none" />

            </motion.div>

            {/* Static Indicators below -> NOW CLICKABLE CONTROLS */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8 px-2">
                <Button
                    variant="ghost"
                    className="h-16 flex flex-col items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border-0"
                    onClick={() => handleSelection(leftOption)}
                >
                    <ChevronLeft className="w-5 h-5 mb-1 opacity-50" />
                    <span className="text-sm font-bold">{leftOption}</span>
                </Button>

                <Button
                    variant="ghost"
                    className="h-16 flex flex-col items-center justify-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border-0"
                    onClick={() => handleSelection(rightOption)}
                >
                    <ChevronRight className="w-5 h-5 mb-1 opacity-50" />
                    <span className="text-sm font-bold">{rightOption}</span>
                </Button>
            </div>
        </div>
    );
}

// ============================================
// Main Component
// ============================================

export function InteractionZone({ task, onComplete, className }: InteractionZoneProps) {
    if (task.style === 'swipe_card' && task.options && task.options.length >= 2) {
        return (
            <div className={cn("relative h-full w-full", className)}>
                <SwipeChoice
                    options={task.options}
                    answerKey={task.answer_key}
                    questionMarkdown={task.question_markdown}
                    onComplete={onComplete}
                />
            </div>
        );
    }

    return null;
}
