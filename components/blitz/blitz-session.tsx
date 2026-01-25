/**
 * Blitz Session Container
 * 功能：
 *   极速跟读模式的主控制器。
 *   管理 Session 队列、当前索引、Revealed 状态。
 *   调用 Action 记录结果。
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

import { BlitzSessionData, BlitzItem } from '@/lib/validations/blitz';
import { recordOutcome } from '@/actions/record-outcome';
import { useTTS } from '@/hooks/use-tts';

import { BlitzCard } from './blitz-card';
import { BlitzControls } from './blitz-controls';
import { Progress } from '@/components/ui/progress';

interface BlitzSessionProps {
    initialData: BlitzSessionData;
    userId: string;
}

export function BlitzSession({ initialData, userId }: BlitzSessionProps) {
    const router = useRouter();
    const { speak, cancel } = useTTS();

    // Game State
    const [items, setItems] = useState<BlitzItem[]>(initialData.items);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentItem = items[currentIndex];
    const progress = ((currentIndex) / items.length) * 100;

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isSubmitting) return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (!isRevealed) handleReveal();
            } else if (e.key === '1') {
                if (isRevealed) handleRate(1);
            } else if (e.key === '2') {
                if (isRevealed) handleRate(3);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRevealed, isSubmitting, currentItem]);

    // Handlers
    const handleReveal = () => {
        setIsRevealed(true);
        if (currentItem) {
            speak(currentItem.context.text);
        }
    };

    const handleRate = async (rating: 1 | 3) => {
        if (!currentItem || isSubmitting) return;
        setIsSubmitting(true);
        cancel(); // Stop audio

        // Optimistic UI Update: Move to next immediately
        const nextIndex = currentIndex + 1;

        // Async Record (Fire & Forget)
        recordOutcome({
            userId,
            vocabId: currentItem.vocabId,
            grade: rating,
            mode: 'SYNTAX', // Blitz counts as Syntax Drill for now
        }).catch(err => {
            console.error('Failed to record outcome', err);
            toast.error('Sync failed, check connection');
        });

        // Feedback Toast
        if (rating === 1) {
            toast('Forgot', { description: 'Scheduled for review soon.', duration: 1000 });
            // Vibrate if mobile
            if (navigator.vibrate) navigator.vibrate(50);
        }

        // Transition Delay
        setTimeout(() => {
            if (nextIndex >= items.length) {
                // Session Complete
                toast.success('Session Complete!', { description: 'Great job!' });
                router.push('/dashboard');
            } else {
                setCurrentIndex(nextIndex);
                setIsRevealed(false);
                setIsSubmitting(false);
            }
        }, 150); // Short delay for button animation
    };

    if (!currentItem) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 className="text-xl font-semibold">All Done!</h2>
                <p className="text-muted-foreground mt-2">Redirecting...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-4rem)] relative max-w-md mx-auto w-full">
            {/* Zone A: Progress */}
            <div className="w-full py-4 px-2 space-y-2">
                <div className="flex justify-between items-end text-xs text-muted-foreground font-mono">
                    <span>PROGRESS</span>
                    <span>{currentIndex + 1} / {items.length}</span>
                </div>
                <Progress value={progress} className="h-1 bg-muted" indicatorClassName="bg-primary/50" />
            </div>

            {/* Zone B: Card */}
            <div className="flex-1 flex flex-col justify-center pb-32"> {/* pb-32 for Zone C space */}
                <BlitzCard
                    item={currentItem}
                    state={isRevealed ? 'REVEALED' : 'LOCKED'}
                    key={currentItem.id} // Key to trigger animation on change
                />
            </div>

            {/* Zone C: Controls */}
            <BlitzControls
                isRevealed={isRevealed}
                onRate={handleRate}
                onReveal={handleReveal}
            />
        </div>
    );
}
