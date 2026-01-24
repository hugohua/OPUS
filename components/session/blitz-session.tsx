'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BlitzCard, type BlitzCardState } from '@/components/blitz/blitz-card';
import { InteractionZone } from '@/components/blitz/interaction-zone';
import { getBlitzBatch, type BlitzBatchItem } from '@/actions/blitz-session';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface BlitzSessionProps {
    userId: string;
}

export function BlitzSession({ userId }: BlitzSessionProps) {
    const [queue, setQueue] = useState<BlitzBatchItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cardState, setCardState] = useState<BlitzCardState>('LOCKED');
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);
    const [stats, setStats] = useState({ pass: 0, fail: 0 });

    useEffect(() => {
        async function init() {
            setLoading(true);
            const res = await getBlitzBatch();
            if (res.status === 'success' && res.data && res.data.length > 0) {
                setQueue(res.data);
            } else {
                // Handle empty state
            }
            setLoading(false);
        }
        init();
    }, [userId]);

    const handleReveal = () => {
        setCardState('REVEALED');
        // small delay before allowing grading? No, instant is better.
        setCardState('GRADING');
    };

    const handleGrade = async (result: 'pass' | 'fail') => {
        // Optimistic update
        setStats(prev => ({ ...prev, [result]: prev[result] + 1 }));

        // TODO: Call server action to record outcome (record-outcome.ts)
        // For now, we simulate success

        // Move next
        if (currentIndex < queue.length - 1) {
            setCardState('LOCKED');
            setCurrentIndex(prev => prev + 1);
        } else {
            setFinished(true);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh] text-slate-400 animate-pulse">
                Loading Blitz Session...
            </div>
        );
    }

    if (queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
                <h2 className="text-xl font-bold">No items available</h2>
                <p className="text-slate-500">Add words to Learning/Review in other modes first.</p>
                <Link href="/dashboard">
                    <Button variant="outline">Back to Dashboard</Button>
                </Link>
            </div>
        )
    }

    if (finished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-2"
                >
                    <h1 className="text-4xl font-bold text-indigo-600">Blitz Complete!</h1>
                    <p className="text-xl text-slate-600">Great reflex training.</p>
                </motion.div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                    <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
                        <div className="text-3xl font-bold text-green-600">{stats.pass}</div>
                        <div className="text-xs text-green-800/60 uppercase tracking-wider">Pass</div>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-xl text-center border border-rose-100">
                        <div className="text-3xl font-bold text-rose-600">{stats.fail}</div>
                        <div className="text-xs text-rose-800/60 uppercase tracking-wider">Missed</div>
                    </div>
                </div>

                <Link href="/dashboard">
                    <Button size="lg" className="w-full max-w-xs">Finish & Return</Button>
                </Link>
            </div>
        )
    }

    const currentItem = queue[currentIndex];

    return (
        <div className="relative min-h-screen w-full max-w-lg mx-auto overflow-hidden bg-background">
            {/* Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 bg-slate-100 z-50">
                <motion.div
                    className="h-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex) / queue.length) * 100}%` }}
                />
            </div>

            <div className="pt-12 px-4">
                <BlitzCard
                    item={currentItem}
                    state={cardState}
                />
            </div>

            <InteractionZone
                state={cardState}
                onReveal={handleReveal}
                onGrade={handleGrade}
            />
        </div>
    );
}
