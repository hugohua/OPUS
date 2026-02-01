'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTTS } from '@/hooks/use-tts';
import { DriveItem, DRIVE_VOICE_CONFIG, DriveMode, DRIVE_VOICE_SPEED_PRESETS, DashScopeVoice } from '@/lib/constants/drive';
import { DriveHeader } from './DriveHeader';
import { DriveMain } from './DriveMain';
import { DriveControls } from './DriveControls';



// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export type PlaybackStage = 'word' | 'gap' | 'meaning' | 'idle';

interface DriveContextType {
    playlist: DriveItem[];
    currentIndex: number;
    isPlaying: boolean;
    playbackStage: PlaybackStage;
    duration: number;
    currentTime: number;
    play: () => void;
    pause: () => void;
    next: () => void;
    prev: () => void;
    seek: (time: number) => void;
}

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------
const DriveContext = createContext<DriveContextType | null>(null);

export const useDrive = () => {
    const context = useContext(DriveContext);
    if (!context) throw new Error('useDrive must be used within DriveLayout');
    return context;
};

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
interface DriveLayoutProps {
    initialPlaylist: DriveItem[];
}

export function DriveLayout({ initialPlaylist }: DriveLayoutProps) {
    const [playlist] = useState<DriveItem[]>(initialPlaylist);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Playback State Machine
    const [playbackStage, setPlaybackStage] = useState<PlaybackStage>('idle');
    const stageTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // TTS Engine
    const tts = useTTS();

    // Derived Current Item
    const currentItem = playlist[currentIndex];

    // ------------------------------------------------------------------
    // Core Orchestrator
    // ------------------------------------------------------------------
    // Watch for 'isPlaying' and 'playbackStage' changes to drive the engine

    // 1. Start Engine Trigger
    useEffect(() => {
        if (!isPlaying || !currentItem) {
            tts.stop();
            clearTimeout(stageTimeoutRef.current!);
            return;
        }

        // If we just started playing (from idle), kick off the first stage
        if (playbackStage === 'idle') {
            startItemSequence(currentItem);
        }
    }, [isPlaying, currentIndex]);

    // 2. Sequence Logic
    const startItemSequence = (item: DriveItem) => {
        // Reset Logic based on Mode
        if (item.mode === 'QUIZ') {
            setPlaybackStage('word');
            playTTS(item.word || item.text, DRIVE_VOICE_CONFIG.QUIZ_QUESTION);
        } else if (item.mode === 'WASH') {
            setPlaybackStage('word');
            playTTS(item.text, DRIVE_VOICE_CONFIG.WASH_PHRASE);
        } else {
            setPlaybackStage('meaning');
            playTTS(item.text, DRIVE_VOICE_CONFIG.STORY);
        }
    };

    const playTTS = (text: string, voiceOverride?: string) => {
        const finalVoice = (voiceOverride || currentItem.voice) as DashScopeVoice;
        // Use preset speed for the voice, fallback to item speed or 1.0
        const finalSpeed = DRIVE_VOICE_SPEED_PRESETS[finalVoice] || currentItem.speed || 1.0;

        tts.play({
            text: text,
            voice: finalVoice,
            language: 'en-US',
            speed: finalSpeed
        });
    };

    // ------------------------------------------------------------------
    // Prefetch Logic (Incremental Background Preloading)
    // ------------------------------------------------------------------
    const PREFETCH_LOOKAHEAD = 5; // Always keep 5 items ahead prefetched
    const prefetchedIndicesRef = React.useRef<Set<number>>(new Set());

    const prefetchNextItems = async () => {
        const allRequests: Array<Promise<any>> = [];

        // Calculate target range: [currentIndex + 1, currentIndex + PREFETCH_LOOKAHEAD]
        for (let offset = 1; offset <= PREFETCH_LOOKAHEAD; offset++) {
            const targetIndex = currentIndex + offset;

            // Skip if out of range or already prefetched
            if (targetIndex >= playlist.length) break;
            if (prefetchedIndicesRef.current.has(targetIndex)) continue;

            const nextItem = playlist[targetIndex];

            // Determine which audios to prefetch based on mode
            if (nextItem.mode === 'QUIZ') {
                // Quiz needs 2 audios: question + answer
                const qVoice = DRIVE_VOICE_CONFIG.QUIZ_QUESTION;
                const qSpeed = DRIVE_VOICE_SPEED_PRESETS[qVoice] || nextItem.speed || 1.0;

                allRequests.push(
                    fetch('/api/tts/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: nextItem.word || nextItem.text,
                            voice: qVoice,
                            language: 'en-US',
                            speed: qSpeed
                        })
                    }).catch(() => { })
                );

                const aVoice = DRIVE_VOICE_CONFIG.QUIZ_ANSWER;
                const aSpeed = DRIVE_VOICE_SPEED_PRESETS[aVoice] || 1.0;

                allRequests.push(
                    fetch('/api/tts/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: nextItem.trans,
                            voice: aVoice,
                            language: 'en-US',
                            speed: aSpeed
                        })
                    }).catch(() => { })
                );
            } else if (nextItem.mode === 'WASH') {
                const wVoice = DRIVE_VOICE_CONFIG.WASH_PHRASE;
                const wSpeed = DRIVE_VOICE_SPEED_PRESETS[wVoice] || nextItem.speed || 1.0;

                allRequests.push(
                    fetch('/api/tts/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: nextItem.text,
                            voice: wVoice,
                            language: 'en-US',
                            speed: wSpeed
                        })
                    }).catch(() => { })
                );
            } else {
                // STORY
                const sVoice = DRIVE_VOICE_CONFIG.STORY;
                const sSpeed = DRIVE_VOICE_SPEED_PRESETS[sVoice] || nextItem.speed || 1.0;

                allRequests.push(
                    fetch('/api/tts/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: nextItem.text,
                            voice: sVoice,
                            language: 'en-US',
                            speed: sSpeed
                        })
                    }).catch(() => { })
                );
            }

            // Mark as prefetched BEFORE request completes (optimistic)
            prefetchedIndicesRef.current.add(targetIndex);
        }

        // Fire all requests in parallel (silent fail)
        if (allRequests.length > 0) {
            console.log(`[Drive Prefetch] Loading ${allRequests.length} new audio(s) for indices after ${currentIndex}`);
            await Promise.allSettled(allRequests);
        }
    };

    // Trigger prefetch when switching to a new card
    useEffect(() => {
        if (isPlaying) {
            // Delay prefetch slightly to prioritize current playback
            const timer = setTimeout(() => {
                prefetchNextItems();
            }, 500); // 500ms delay
            return () => clearTimeout(timer);
        }
    }, [currentIndex]); // ✅ 只在切换卡片时触发，避免 playbackStage 变化导致重复加载

    // 3. Stage Transition (On TTS End)
    // We listen to tts.status changes. When it goes from 'playing' -> 'idle', and we are isPlaying, move next.
    // Issue: useTTS 'idle' might be initial state. We need to track if we *were* playing.
    const wasTTSPlayingRef = React.useRef(false);

    useEffect(() => {
        const isTTSPlaying = tts.status === 'playing';
        const isTTSIdle = tts.status === 'idle';

        if (wasTTSPlayingRef.current && isTTSIdle && isPlaying) {
            // TTS just finished. Decide next step.
            handleStageComplete();
        }

        wasTTSPlayingRef.current = isTTSPlaying;
    }, [tts.status, isPlaying]);

    const handleStageComplete = () => {
        if (!currentItem) return;

        if (currentItem.mode === 'QUIZ') {
            if (playbackStage === 'word') {
                // Word finished -> Go to Gap
                setPlaybackStage('gap');
                // Wait 2s
                stageTimeoutRef.current = setTimeout(() => {
                    setPlaybackStage('meaning');
                    // Play Meaning/Sentence
                    // Quiz Step 3: "Answer: Meaning + Collocation"
                    // If trans implies the sentence, play trans or the full text if it was just a word?
                    // Let's assume input text is the word. We should play the example sentence or meaning.
                    // For now, let's play the item.trans (which we mapped to commonExample or def)
                    playTTS(currentItem.trans, DRIVE_VOICE_CONFIG.QUIZ_ANSWER);
                }, 2500); // 2.5s Gap
            } else if (playbackStage === 'meaning') {
                // Meaning finished -> Next
                next();
            }
        } else if (currentItem.mode === 'WASH') {
            // WASH: 短语播放完后停顿 1 秒,让用户有时间吸收
            stageTimeoutRef.current = setTimeout(() => {
                next();
            }, 1000);
        } else {
            // STORY -> Next
            next();
        }
    };

    // ------------------------------------------------------------------
    // Controls
    // ------------------------------------------------------------------
    const play = () => setIsPlaying(true);
    const pause = () => setIsPlaying(false);

    const next = () => {
        clearTimeout(stageTimeoutRef.current!);
        setPlaybackStage('idle'); // Reset stage
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
        setIsPlaying(true); // Ensure we keep playing
    };

    const prev = () => {
        clearTimeout(stageTimeoutRef.current!);
        setPlaybackStage('idle');
        setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
        setIsPlaying(true);
    };

    return (
        <DriveContext.Provider value={{
            playlist,
            currentIndex,
            isPlaying,
            playbackStage, // Exposed for UI
            duration: tts.duration,
            currentTime: tts.currentTime,
            play, pause, next, prev,
            seek: () => { } // TTS Seek not fully supported yet in this simplified hook usage
        }}>
            <div className="relative w-full h-screen bg-background text-foreground overflow-hidden flex flex-col font-sans selection:bg-primary/30">
                <DriveHeader />
                <DriveMain />
                <DriveControls />
            </div>
        </DriveContext.Provider>
    );
}
