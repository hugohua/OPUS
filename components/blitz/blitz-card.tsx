'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { maskPhrase } from '@/lib/blitz';
import type { BlitzItem } from '@/lib/validations/blitz';

export type BlitzCardState = 'LOCKED' | 'REVEALED' | 'GRADING';

interface BlitzCardProps {
    item: BlitzItem;
    state: BlitzCardState;
}

export function BlitzCard({ item, state }: BlitzCardProps) {
    const segments = useMemo(() => maskPhrase(item.context.text, item.word), [item]);

    const isRevealed = state === 'REVEALED' || state === 'GRADING';

    return (
        <div className="w-full max-w-md mx-auto py-12 flex flex-col items-center justify-center min-h-[40vh] select-none">
            <div className="text-3xl md:text-4xl font-serif text-center leading-relaxed">
                {segments.map((seg, i) => {
                    if (seg.type === 'static') {
                        return <span key={i} className="text-slate-700 dark:text-slate-300 transition-colors">{seg.text}</span>;
                    }

                    if (seg.type === 'target-first-char') {
                        return (
                            <span key={i} className={cn(
                                "inline-block font-bold transition-all duration-300",
                                isRevealed ? "text-indigo-600 dark:text-indigo-400" : "text-slate-900 dark:text-slate-100"
                            )}>
                                {seg.text}
                            </span>
                        );
                    }

                    if (seg.type === 'masked') {
                        return (
                            <span key={i} className="inline-block relative">
                                <AnimatePresence mode="wait">
                                    {isRevealed ? (
                                        <motion.span
                                            key="revealed"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="font-bold text-indigo-600 dark:text-indigo-400"
                                        >
                                            {seg.text}
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="masked"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-slate-300 dark:text-slate-600 font-mono tracking-widest pl-1"
                                        >
                                            {/* Visual hint of length, but abstract */}
                                            {'_'.repeat(Math.min(seg.text.length, 5))}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                        );
                    }
                    return null;
                })}
            </div>

            {/* Translation & Word Info (Revealed State) */}
            <div className="h-24 mt-8 w-full flex flex-col items-center justify-start">
                <AnimatePresence>
                    {isRevealed && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-3"
                        >
                            <div className="text-xl text-slate-600 dark:text-slate-400 font-medium">
                                {item.context.translation}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                    {item.word}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
