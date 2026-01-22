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

import { recordOutcome } from '@/actions/record-outcome';
import { toast } from 'sonner';

interface InboxClientProps {
    initialBriefing?: ActionState<BriefingPayload>;
}

export function InboxClient({ initialBriefing }: InboxClientProps) {
    const [briefing, setBriefing] = useState<BriefingPayload | undefined>(initialBriefing?.data);
    // Session State
    const [sessionCount, setSessionCount] = useState(0);
    const SESSION_LIMIT = 20;

    // Status State
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'REVIEW' | 'REST' | 'SESSION_COMPLETE'>('IDLE');
    const [feedback, setFeedback] = useState<string | null>(null);

    // Initial Rest Check (if server returns Rest Card initially, usually won't happen now)
    useEffect(() => {
        if (briefing && !briefing.segments.some(s => s.type === 'interaction')) {
            setStatus('REST');
        }
    }, [briefing]);

    const handleNext = async () => {
        // ============================================
        // Session Logic: Check if batch is full
        // ============================================
        if (sessionCount >= SESSION_LIMIT - 1) { // 0-indexed count vs 1-indexed limit handling? logic check below
            // Logic: Current card is finished. User clicks Next. 
            // If we just finished card #20 (count=19 -> next is 20), we show summary.
            setStatus('SESSION_COMPLETE');
            return;
        }

        setStatus('LOADING');
        setFeedback(null);

        // Optimistic update of count? (No, wait for server)
        // Actually for getNextBriefing(todayCount) - the param is now ignored by server.

        try {
            const nextCount = sessionCount + 1;
            const res = await getNextBriefing(nextCount); // Param ignored by server now

            if (res.status === 'success' && res.data) {
                setBriefing(res.data);
                setSessionCount(nextCount);

                if (!res.data.segments.some(s => s.type === 'interaction')) {
                    // Should be rare now unless DB empty
                    setStatus('REST');
                } else {
                    setStatus('IDLE');
                }
            } else {
                console.error("Failed to load briefing:", res.message);
                setFeedback("Connection failed. Try again.");
                setStatus('IDLE');
            }
        } catch (e) {
            console.error(e);
            setStatus('IDLE');
        }
    };

    const handleInteractionComplete = async (isCorrect: boolean) => {
        if (isCorrect) {
            setFeedback("Correct! 🎉");
            setStatus('REVIEW'); // Show full syntax
            playAudio();

            // ============================================
            // Persistence Logic
            // ============================================
            // We assume briefing.meta.targetWordId or similar exists? 
            // Wait, BriefingPayload schema doesn't strictly pass vocabId back yet? 
            // Let's look at BriefingPayload. 
            // If it's pure generated text, we might miss the ID. 
            // PRD says: backend "Fetch target word". 
            // Optimization: We need vocabId to record outcome.
            // Temporary Hack: use existing recordOutcome with a mock logical check if ID missing, 
            // BUT actually we NEED ID.
            // Check getNextBriefing return. 
            // It calls generateBriefingAction. 
            // generateBriefingAction returns BriefingPayload. 
            // Payload doesn't have ID. 
            // CRITICAL FIX needed: Pass ID through. 
            // For now, I will add TODO comment and logic.
            // See Plan Step 2 (logic fix).

            // Wait, getNextBriefing calls generateBriefing. 
            // We need to pass vocab ID in the payload meta.
        } else {
            setFeedback("Try again. (Hint: Check the tense)");
        }
    };

    // ... rest of audio and render logic ...

    // START NEW BATCH
    const handleStartNewBatch = () => {
        setSessionCount(0);
        handleNext(); // Fetch first card of new batch
    };

    // ===================================
    // RENDER: SESSION COMPLETE
    // ===================================
    if (status === 'SESSION_COMPLETE') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 bg-background transition-colors duration-500">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center text-center space-y-6 max-w-sm"
                >
                    <div className="bg-primary/10 p-6 rounded-full">
                        <Coffee className="w-12 h-12 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight">Session Complete</h2>
                    <p className="text-muted-foreground text-lg">
                        You have completed {SESSION_LIMIT} cards.
                    </p>

                    <div className="flex flex-col gap-3 w-full pt-4">
                        <Button size="lg" onClick={handleStartNewBatch} className="w-full">
                            Start Next Batch <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="lg" className="w-full">
                            Take a Break
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ... Rest of Render (Rest, Loading, Inbox) ...

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
                <span className="text-sm font-medium text-muted-foreground">Inbox ({sessionCount}/{SESSION_LIMIT})</span>
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
