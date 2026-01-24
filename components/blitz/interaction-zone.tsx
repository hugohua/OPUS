'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { type BlitzCardState } from './blitz-card';
import { Check, X, Eye } from 'lucide-react';

interface InteractionZoneProps {
    state: BlitzCardState;
    onReveal: () => void;
    onGrade: (result: 'pass' | 'fail') => void;
}

export function InteractionZone({ state, onReveal, onGrade }: InteractionZoneProps) {
    const isLocked = state === 'LOCKED';

    return (
        <div className="fixed bottom-0 left-0 w-full h-[35vh] bg-gradient-to-t from-background via-background/95 to-transparent flex flex-col items-center justify-end pb-12 px-6 z-10">
            <AnimatePresence mode="wait">
                {isLocked ? (
                    <motion.div
                        key="reveal-trigger"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="w-full h-full flex items-end justify-center pb-8 cursor-pointer"
                        onClick={onReveal}
                    >
                        <div className="flex flex-col items-center gap-2 text-slate-400 animate-pulse">
                            <Eye className="w-8 h-8" />
                            <span className="text-sm tracking-widest uppercase font-medium">Tap to Reveal</span>
                        </div>
                        {/* Invisible large touch area */}
                        <div className="absolute inset-0 w-full h-full" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="grading-buttons"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex gap-4 w-full max-w-sm"
                    >
                        <Button
                            variant="outline"
                            size="lg"
                            className="flex-1 h-14 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:text-rose-400"
                            onClick={() => onGrade('fail')}
                        >
                            <X className="w-5 h-5 mr-2" />
                            Forgot
                        </Button>

                        <Button
                            variant="default" // Primary color for Pass
                            size="lg"
                            className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
                            onClick={() => onGrade('pass')}
                        >
                            <Check className="w-5 h-5 mr-2" />
                            Got it
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
