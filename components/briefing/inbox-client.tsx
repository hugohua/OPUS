'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Volume2, ArrowRight, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getNextBriefing } from '@/actions/game-loop';
import { SyntaxText } from './syntax-text';
import { InteractionZone } from './interaction-zone';
import type { BriefingPayload } from '@/lib/validations/briefing';
import type { ActionState } from '@/types';

interface InboxClientProps {
    initialBriefing?: ActionState<BriefingPayload>;
}

export function InboxClient({ initialBriefing }: InboxClientProps) {
    const [briefing, setBriefing] = useState<BriefingPayload | undefined>(initialBriefing?.data);
    const [todayCount, setTodayCount] = useState(0);
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'REVIEW' | 'REST'>('IDLE');
    const [feedback, setFeedback] = useState<string | null>(null);

    // Determines if we are in Interaction Phase or Review Phase
    // If we have an interaction task, we start in 'IDLE' (Challenge mode).
    // Once answered, we go to 'REVIEW'.

    // Check for Rest Card on load
    useEffect(() => {
        if (briefing && !briefing.segments.some(s => s.type === 'interaction')) {
            setStatus('REST');
        }
    }, [briefing]);

    const handleNext = async () => {
        setStatus('LOADING');
        setFeedback(null);

        // Optimistic update of count?
        const nextCount = todayCount + 1;
        setTodayCount(nextCount);

        try {
            const res = await getNextBriefing(nextCount);
            if (res.status === 'success' && res.data) {
                setBriefing(res.data);
                // Check if it's a Rest Card
                if (!res.data.segments.some(s => s.type === 'interaction')) {
                    setStatus('REST');
                } else {
                    setStatus('IDLE'); // Ready for new challenge
                }
            } else {
                console.error("Failed to load briefing:", res.message);
                // Simple error handling for MVP
                setFeedback("Connection failed. Try again.");
                setStatus('IDLE');
            }
        } catch (e) {
            console.error(e);
            setStatus('IDLE');
        }
    };

    const handleInteractionComplete = (isCorrect: boolean) => {
        if (isCorrect) {
            setFeedback("Correct! 🎉");
            setStatus('REVIEW'); // Show full syntax
            playAudio();
        } else {
            setFeedback("Try again. (Hint: Check the tense)");
            // Shake effect or similar could be added here
        }
    };

    const playAudio = () => {
        const textWrapper = briefing?.segments.find(s => s.type === 'text');
        const text = textWrapper?.audio_text || textWrapper?.content_markdown?.replace(/<[^>]+>/g, '');

        if (text && typeof window !== 'undefined') {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }
    };

    // Derived Data
    const textSegment = briefing?.segments.find(s => s.type === 'text');
    const interactionSegment = briefing?.segments.find(s => s.type === 'interaction');

    // ===================================
    // RENDER: REST CARD
    // ===================================
    if (status === 'REST') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 bg-background transition-colors duration-500">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center text-center space-y-4 max-w-sm"
                >
                    <div className="bg-primary/10 p-6 rounded-full">
                        <Coffee className="w-12 h-12 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight">Mission Accomplished</h2>
                    <p className="text-muted-foreground text-lg">
                        {textSegment?.content_markdown || "You survived today. See you tomorrow."}
                    </p>
                    <div className="text-sm font-medium text-muted-foreground/50 uppercase tracking-widest pt-8">
                        Daily Cap Reached
                    </div>
                </motion.div>
            </div>
        );
    }

    // ===================================
    // RENDER: LOADING
    // ===================================
    if (status === 'LOADING') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-4 w-32 bg-secondary rounded"></div>
                    <div className="h-64 w-64 bg-secondary rounded-xl"></div>
                </div>
            </div>
        );
    }

    // ===================================
    // RENDER: INBOX FLOW
    // ===================================
    // ===================================
    // RENDER: INBOX FLOW
    // ===================================
    return (
        <div className="min-h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-x-hidden overflow-y-auto overscroll-y-none bg-background">
            {/* Header: Progress / Status */}
            <div className="h-16 flex items-center justify-between px-6 border-b bg-background/80 backdrop-blur z-50 sticky top-0 shrink-0">
                <span className="text-sm font-medium text-muted-foreground">Inbox ({todayCount}/20)</span>
                <Button variant="ghost" size="icon" onClick={() => playAudio()}>
                    <Volume2 className="w-5 h-5" />
                </Button>
            </div>

            {/* Main Stage - Flow Layout (No Flex-1 Compression) */}
            <main className="flex flex-col items-center justify-center p-6 space-y-8 w-full min-h-0 grow">

                {/* 1. REVIEW PHASE: Show Syntax Highlighted Text */}
                {status === 'REVIEW' && textSegment && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full space-y-4"
                    >
                        <Card className="p-6 border-primary/20 bg-primary/5 shadow-lg space-y-4">
                            <SyntaxText content={textSegment.content_markdown} />

                            {/* NEW: Explanation Logic */}
                            {interactionSegment?.task?.explanation_markdown && (
                                <div className="pt-4 border-t border-primary/10">
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-background/50 p-3 rounded-md">
                                        <span className="shrink-0 text-primary">💡</span>
                                        <p>{interactionSegment.task.explanation_markdown}</p>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {textSegment.translation_cn && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-center text-muted-foreground text-sm"
                            >
                                {textSegment.translation_cn}
                            </motion.p>
                        )}
                    </motion.div>
                )}

                {/* 2. CHALLENGE PHASE: Interaction Zone */}
                {status === 'IDLE' && interactionSegment && (
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full flex flex-col justify-center"
                    >
                        <InteractionZone
                            task={interactionSegment.task as any}
                            onComplete={handleInteractionComplete}
                        />
                    </motion.div>
                )}

                {/* Feedback Toast/Text */}
                <div className="h-8 flex items-center justify-center shrink-0">
                    {feedback && (
                        <motion.span
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-sm font-semibold text-primary"
                        >
                            {feedback}
                        </motion.span>
                    )}
                </div>

            </main>

            {/* Footer: Control */}
            <div className="p-6 pb-12 bg-background/80 backdrop-blur shrink-0 mt-auto">
                {status === 'REVIEW' && (
                    <Button
                        size="lg"
                        className="w-full text-lg shadow-xl shadow-primary/20"
                        onClick={handleNext}
                    >
                        Next Briefing <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                )}
                {status === 'IDLE' && (
                    <p className="text-center text-xs text-muted-foreground/50">
                        Swipe or Tap to Resolve
                    </p>
                )}
            </div>
        </div>
    );
}
