"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AudioDrillCard } from "@/components/drill/audio-drill-card";
import { useTTS } from "@/hooks/use-tts";
import { toast } from "sonner";
import { getAudioSession, submitAudioGrade } from "@/actions/audio-session";
import { AudioDrillCardSkeleton } from "@/components/drill/audio-drill-card-skeleton";

export function AudioSessionRunner() {
    const router = useRouter();
    const tts = useTTS();

    // 定义 Queue Item 类型
    interface QueueItem {
        id: string; // UserProgress ID
        vocabId: number; // Vocab ID for grading
        word: string;
        phonetic?: string;
        definition?: string;
        voice: string;
    }

    // Initialize queue as an empty array, expecting real data to be fetched
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSessionActive, setIsSessionActive] = useState(true);
    const [isLoading, setIsLoading] = useState(true); // New loading state

    // Timer for Implicit Grading
    const startTimeRef = useRef<number>(0);

    // Fetch real data when the component mounts
    useEffect(() => {
        const fetchQueue = async () => {
            try {
                setIsLoading(true);
                const result = await getAudioSession();

                if (result.status === 'success' && result.data?.items) {
                    setQueue(result.data.items as QueueItem[]);
                } else {
                    toast.info("当前没有待复习的单词");
                    router.push("/dashboard");
                }
            } catch (error) {
                console.error("Failed to fetch audio session:", error);
                toast.error("加载训练队列失败，请重试");
                router.push("/dashboard");
            } finally {
                setIsLoading(false);
            }
        };
        fetchQueue();
    }, []); // Run once on mount

    const currentItem = queue[currentIndex];

    // Progress calculation
    const progress = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 0;

    // 1. Auto-Play Logic
    useEffect(() => {
        if (!currentItem || !isSessionActive || isLoading) return; // Add isLoading check

        // Start Timer
        startTimeRef.current = Date.now();

        // Trigger TTS
        const playAudio = async () => {
            await tts.play({
                text: currentItem.word, // Or use a phrase? "spell {word}"? For now just word.
                voice: currentItem.voice || "Cherry",
                speed: 1.0
            });
        };

        playAudio();

        // Cleanup? useTTS handles internal cleanup
    }, [currentIndex, currentItem, isLoading]); // [Optimization] Removed tts.play to prevent re-triggering

    const handlePlay = () => {
        if (!currentItem) return;
        tts.play({
            text: currentItem.word,
            voice: currentItem.voice || "Cherry"
        });
    };

    const handleReveal = () => {
        // Stop audio when revealing? Or keep playing? User preference.
        // Let's keep it playing or idle.
        // tts.stop();
    };

    const handleGrade = async (grade: 1 | 2 | 3 | 4) => {
        const duration = Date.now() - startTimeRef.current;
        console.log(`[Grading] Grade: ${grade}, Duration: ${duration}ms`);

        // Call Server Action to save progress (FSRS)
        if (currentItem) {
            try {
                await submitAudioGrade({
                    vocabId: currentItem.vocabId,
                    grade,
                    duration
                });
            } catch (error) {
                console.error("Failed to update drill progress:", error);
                toast.error("保存进度失败，请检查网络连接");
            }
        }


        // Next Item
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Session Complete
            toast.success("Session Complete!");
            router.push("/dashboard");
        }
    };

    const handleExit = () => {
        setIsSessionActive(false);
        tts.stop();
        router.push("/dashboard");
    };

    if (isLoading) {
        return <AudioDrillCardSkeleton />;
    }

    if (!currentItem) {
        // This case should ideally be handled by the `isLoading` check and redirect
        // but as a fallback, if queue is empty after loading.
        return <div>No items in the current drill session.</div>;
    }

    return (
        <AudioDrillCard
            vocab={currentItem}
            isPlaying={tts.isPlaying}
            onPlay={handlePlay}
            onReveal={handleReveal}
            onGrade={handleGrade}
            progress={progress}
            onExit={handleExit}
        />
    );
}
