'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { SyntaxText } from '@/components/briefing/syntax-text';
import { InteractionZone } from '@/components/briefing/interaction-zone';
import { recordOutcome } from '@/actions/record-outcome';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SessionRunnerProps {
    initialPayload: BriefingPayload[];
    userId: string;
    mode: SessionMode;
}

const LOAD_THRESHOLD = 5; // Load more when 5 cards remaining
const BATCH_LIMIT = 10;

export function SessionRunner({ initialPayload, userId, mode }: SessionRunnerProps) {
    const router = useRouter();
    const [queue, setQueue] = useState<BriefingPayload[]>(initialPayload);
    const [index, setIndex] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Track loaded VocabIDs to exclude them in next fetch
    // Initialize with IDs from initial payload
    const loadedVocabIds = useRef<Set<number>>(new Set(
        initialPayload.map(p => (p.meta as any).vocabId).filter(Boolean)
    ));

    const currentDrill = queue[index];
    // Dynamic progress? Or just show count completed?
    // "Infinite Flow" usually doesn't have a fixed end.
    // Let's show "Cards Mastered: X" instead of progress bar?
    // Or just a visual indicator of current batch.
    // For now, keep progress bar relative to current queue length to show buffer status?
    // Actually, user wants "Session based" feel but "Infinite".
    // Let's keeps progress bar as "Progress in current session" (accumulating).
    // Or maybe just hide it and show counter.

    const countDisplay = index + 1;

    // --- Lazy Loading Logic ---
    useEffect(() => {
        const remaining = queue.length - index;
        if (remaining <= LOAD_THRESHOLD && !isLoadingMore) {
            loadMore();
        }
    }, [index, queue.length, isLoadingMore]);

    const loadMore = async () => {
        setIsLoadingMore(true);
        try {
            const excludeIds = Array.from(loadedVocabIds.current);
            const res = await getNextDrillBatch({
                userId,
                mode,
                limit: BATCH_LIMIT,
                excludeVocabIds: excludeIds
            });

            if (res.status === 'success' && res.data && res.data.length > 0) {
                const newItems = res.data;

                // Update exclusion set
                newItems.forEach(item => {
                    const vid = (item.meta as any).vocabId;
                    if (vid) loadedVocabIds.current.add(vid);
                });

                setQueue(prev => [...prev, ...newItems]);
                toast.success('Reinforcements arrived!', { duration: 1000 });
            } else {
                // No more items or error?
                // If error, maybe just silent fail and try again later?
                // If no more items, we just finish normally when user hits end.
                console.log("No more items or failed to fetch", res);
            }
        } catch (e) {
            console.error("Load more failed", e);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const textSegment = currentDrill?.segments.find(s => s.type === 'text');
    const interactSegment = currentDrill?.segments.find(s => s.type === 'interaction');

    const handleComplete = async (isCorrect: boolean) => {
        const vocabId = (currentDrill.meta as any).vocabId || 0;
        const grade = isCorrect ? 3 : 1;

        // Fire and forget
        recordOutcome({ userId, vocabId, grade, mode }).catch(e => console.error(e));

        // Advance
        if (index < queue.length - 1) {
            setIndex(i => i + 1);
        } else {
            // End of queue (and loadMore failed to get new ones)
            setCompleted(true);
        }
    };

    if (completed) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] space-y-6 text-center animate-in fade-in duration-500">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                    <CheckCircle className="w-16 h-16" />
                </div>
                <h1 className="text-3xl font-bold">Session Complete!</h1>
                <p className="text-muted-foreground">You've cleared all available drills.</p>
                <Button onClick={() => router.push('/dashboard/simulate')} size="lg">
                    Return to HQ
                </Button>
            </div>
        )
    }

    if (!currentDrill) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Top: Header & Counter */}
            <div className="flex items-center gap-4 py-4 px-2">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/simulate')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1 flex justify-center">
                    <div className="bg-muted/50 px-4 py-1 rounded-full text-xs font-mono text-muted-foreground flex items-center gap-2">
                        <span>DRILL #{countDisplay}</span>
                        {isLoadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                </div>
                <div className="w-9" /> {/* Spacer for centering */}
            </div>

            {/* Middle: Content Renderer */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
                {/* Context Card */}
                {textSegment && (
                    <Card className="p-6 w-full shadow-md border-l-4 border-l-primary/50 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-4 opacity-70">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                            <div className="text-xs font-medium uppercase">System Briefing</div>
                        </div>

                        <SyntaxText content={textSegment.content_markdown || ''} />

                        {textSegment.translation_cn && (
                            <p className="mt-4 text-sm text-muted-foreground border-t pt-2">
                                {textSegment.translation_cn}
                            </p>
                        )}
                    </Card>
                )}

                {/* Interaction */}
                {interactSegment && interactSegment.task && (
                    <InteractionZone
                        key={index} // Reset state on change
                        task={interactSegment.task}
                        onComplete={handleComplete}
                    />
                )}
            </div>
        </div>
    );
}
