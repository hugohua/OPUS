/**
 * BlitzSession - Focus Shell Implementation
 * 
 * Replaces UniversalCard with FocusShell and ControlDeck.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlitzCard, type BlitzCardState } from '@/components/blitz/blitz-card';
import { getBlitzSession } from '@/actions/get-blitz-session';
import { recordOutcome } from '@/actions/record-outcome';
import { markVocabMastered } from '@/actions/vocab-actions';
import { BlitzItem } from '@/lib/validations/blitz';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FocusShell } from '@/components/drill/focus-shell';
import { ControlDeck, ControlDeckMode } from '@/components/drill/control-deck';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BlitzSessionProps {
    userId: string;
}

export function BlitzSession({ userId }: BlitzSessionProps) {
    const router = useRouter();
    const [queue, setQueue] = useState<BlitzItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cardState, setCardState] = useState<BlitzCardState>('LOCKED');
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);
    const [isMarkingMastered, setIsMarkingMastered] = useState(false);
    const [stats, setStats] = useState({ pass: 0, fail: 0 });

    useEffect(() => {
        async function init() {
            setLoading(true);
            const res = await getBlitzSession();
            if (res.status === 'success' && res.data?.items && res.data.items.length > 0) {
                setQueue(res.data.items);
            } else {
                // Handle empty state if needed
            }
            setLoading(false);
        }
        init();
    }, [userId]);

    const handleReveal = () => {
        setCardState('REVEALED');
        // Immediate transition to grading is typical for Blitz?
        // Original code: setCardState('GRADING');
        setCardState('GRADING');
    };

    const handleGrade = async (result: 'pass' | 'fail') => {
        const currentItem = queue[currentIndex];

        // Optimistic update
        setStats(prev => ({ ...prev, [result]: prev[result] + 1 }));

        // [Track Persistence] Record outcome
        const grade = result === 'pass' ? 3 : 1;
        recordOutcome({
            userId,
            vocabId: currentItem.vocabId,
            grade: grade as any,
            mode: 'BLITZ',
            track: currentItem.track,
        }).catch(err => {
            console.error('Failed to record outcome:', err);
        });

        // Move next
        if (currentIndex < queue.length - 1) {
            setCardState('LOCKED');
            setCurrentIndex(prev => prev + 1);
        } else {
            setFinished(true);
        }
    };

    // --- Control Deck Handler ---
    const handleDeckAction = (action: string) => {
        if (action === 'reveal') {
            handleReveal();
        } else if (['1', '2'].includes(action)) {
            // Binary Grade: 1=Fail, 2=Pass
            if (action === '1') handleGrade('fail');
            if (action === '2') handleGrade('pass');
        }
    };

    const handleMarkMastered = async () => {
        const currentItem = queue[currentIndex];
        if (!currentItem || currentItem.vocabId <= 0 || isMarkingMastered) return;

        const vocabId = currentItem.vocabId;
        setIsMarkingMastered(true);
        setCardState('LOCKED');
        setQueue(prev => {
            const keptBeforeCurrent = prev
                .slice(0, currentIndex)
                .filter(item => item.vocabId !== vocabId)
                .length;
            const next = prev.filter(item => item.vocabId !== vocabId);

            if (next.length === 0) {
                setCurrentIndex(0);
                setFinished(true);
                return [];
            }

            setCurrentIndex(Math.min(keptBeforeCurrent, next.length - 1));
            return next;
        });

        try {
            const result = await markVocabMastered(vocabId);
            if (result.status === 'error') {
                throw new Error(result.message);
            }
            toast.success('已标为已掌握');
        } catch (error) {
            console.error('Failed to mark mastered:', error);
            toast.error('同步失败，稍后仍可能再次出现');
        } finally {
            setIsMarkingMastered(false);
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 text-slate-400 animate-pulse">
                加载中...
            </div>
        );
    }

    // --- Empty State ---
    if (queue.length === 0) {
        return (
            <FocusShell variant="L0" progress={0} onExit={() => router.push('/dashboard')}>
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <h2 className="text-xl font-bold font-serif text-zinc-800 dark:text-zinc-200">暂无可用项目</h2>
                    <p className="text-zinc-500 font-mono text-sm">请先在其他模式中学习新词。</p>
                    <Link href="/dashboard">
                        <Button variant="outline" className="mt-4">返回主页</Button>
                    </Link>
                </div>
            </FocusShell>
        )
    }

    // --- Finished State ---
    if (finished) {
        return (
            <FocusShell variant="L2" progress={100} onExit={() => router.push('/dashboard')}>
                <div className="flex flex-col items-center justify-center gap-8 p-6 w-full max-w-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center space-y-2"
                    >
                        <h1 className="text-4xl font-bold font-serif text-indigo-600 dark:text-indigo-400">闪电战完成！</h1>
                        <p className="text-xl text-zinc-600 dark:text-zinc-400 font-serif italic">训练结束</p>
                    </motion.div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center border border-emerald-100 dark:border-emerald-800">
                            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{stats.pass}</div>
                            <div className="text-[10px] text-emerald-800/60 dark:text-emerald-400/60 uppercase tracking-widest font-mono">通过</div>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl text-center border border-rose-100 dark:border-rose-800">
                            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 font-mono">{stats.fail}</div>
                            <div className="text-[10px] text-rose-800/60 dark:text-rose-400/60 uppercase tracking-widest font-mono">未通过</div>
                        </div>
                    </div>

                    <Link href="/dashboard" className="w-full">
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            返回主页
                        </Button>
                    </Link>
                </div>
            </FocusShell>
        )
    }

    const currentItem = queue[currentIndex];
    const deckMode: ControlDeckMode = cardState === 'LOCKED' ? 'reveal' : 'binary';
    // Progress loop
    const progress = ((currentIndex) / queue.length) * 100;
    const markMasteredAction = currentItem?.vocabId > 0 ? (
        <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="标为已掌握"
            title="标为已掌握"
            disabled={isMarkingMastered}
            onClick={handleMarkMastered}
        >
            <CheckCircle2 data-icon="inline-start" />
            熟
        </Button>
    ) : undefined;

    return (
        <FocusShell
            variant="L2" // Violet for Blitz
            label="每日闪电战"
            progress={progress}
            onExit={() => router.push('/dashboard')}
            rightAction={markMasteredAction}
            footer={
                <ControlDeck
                    mode={deckMode}
                    onAction={handleDeckAction}
                    labels={{ '1': '忘了', '2': '记得' }}
                />
            }
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentItem.vocabId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full flex items-center justify-center p-4 relative"
                >
                    <BlitzCard
                        item={currentItem}
                        state={cardState}
                    />
                </motion.div>
            </AnimatePresence>
        </FocusShell>
    );
}
