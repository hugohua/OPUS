'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTTS } from '@/hooks/use-tts';
import { DriveItem, DRIVE_VOICE_CONFIG, DriveMode, DriveTrack, DRIVE_VOICE_SPEED_PRESETS, DashScopeVoice } from '@/lib/constants/drive';
import { generateDrivePlaylist } from '@/actions/drive';
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
    initialCursor: number | null;
    initialHasMore: boolean;
    track: DriveTrack;
}

export function DriveLayout({
    initialPlaylist,
    initialCursor,
    initialHasMore,
    track
}: DriveLayoutProps) {
    // ✅ V2: 支持动态加载
    const [playlist, setPlaylist] = useState<DriveItem[]>(initialPlaylist);
    const [cursor, setCursor] = useState<number | null>(initialCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Playback State Machine
    const [playbackStage, setPlaybackStage] = useState<PlaybackStage>('idle');
    const stageTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // TTS Engine
    const tts = useTTS();

    // ------------------------------------------------------------------
    // Load More Logic (V2)
    // ------------------------------------------------------------------
    // ✅ 使用 ref 存储 loading 状态，避免 useCallback 频繁重建
    const isLoadingRef = React.useRef(false);

    const loadMore = useCallback(async () => {
        // 使用 ref 双重检查，防止并发调用
        if (!hasMore || isLoadingRef.current || cursor === null) return;

        isLoadingRef.current = true;
        setIsLoadingMore(true);
        try {
            const res = await generateDrivePlaylist({ track, cursor, pageSize: 15 });
            setPlaylist(prev => [...prev, ...res.items]);
            setCursor(res.nextCursor);
            setHasMore(res.hasMore);
            console.log('[Drive] Loaded more items:', res.items.length, 'hasMore:', res.hasMore);
        } catch (error) {
            console.error('[Drive] Load more failed:', error);
        } finally {
            isLoadingRef.current = false;
            setIsLoadingMore(false);
        }
    }, [hasMore, cursor, track]); // ✅ 移除 isLoadingMore 依赖，使用 ref 代替

    // 自动触发 Load More：剩余 3 个时预加载
    useEffect(() => {
        const remaining = playlist.length - currentIndex;
        if (remaining <= 3 && hasMore && !isLoadingRef.current) {
            loadMore();
        }
    }, [currentIndex, playlist.length, hasMore, loadMore]); // ✅ 移除 isLoadingMore

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
    // ------------------------------------------------------------------
    // Prefetch Logic (Incremental Background Preloading)
    // V2: 完整预加载 - 生成 + 下载到浏览器缓存
    // ------------------------------------------------------------------
    const PREFETCH_LOOKAHEAD = 5; // Always keep 5 items ahead prefetched
    const prefetchedIndicesRef = React.useRef<Set<number>>(new Set());
    const preloadedAudiosRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

    // 🔥 核心：生成音频并预加载到浏览器
    const generateAndPreload = async (text: string, voice: DashScopeVoice, speed: number): Promise<void> => {
        try {
            const response = await fetch('/api/tts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, language: 'en-US', speed })
            });

            if (!response.ok) return;

            const { url } = await response.json();
            if (!url || preloadedAudiosRef.current.has(url)) return;

            // ✅ 预加载音频到浏览器内存
            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.load();

            // 缓存引用，防止被 GC
            preloadedAudiosRef.current.set(url, audio);

            console.log(`[Drive Prefetch] Preloaded: ${text.slice(0, 20)}...`);
        } catch {
            // 静默失败
        }
    };

    const prefetchNextItems = async () => {
        const allRequests: Array<Promise<void>> = [];

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
                allRequests.push(generateAndPreload(nextItem.word || nextItem.text, qVoice, qSpeed));

                const aVoice = DRIVE_VOICE_CONFIG.QUIZ_ANSWER;
                const aSpeed = DRIVE_VOICE_SPEED_PRESETS[aVoice] || 1.0;
                allRequests.push(generateAndPreload(nextItem.trans, aVoice, aSpeed));
            } else if (nextItem.mode === 'WASH') {
                const wVoice = DRIVE_VOICE_CONFIG.WASH_PHRASE;
                const wSpeed = DRIVE_VOICE_SPEED_PRESETS[wVoice] || nextItem.speed || 1.0;
                allRequests.push(generateAndPreload(nextItem.text, wVoice, wSpeed));
            } else {
                // STORY
                const sVoice = DRIVE_VOICE_CONFIG.STORY;
                const sSpeed = DRIVE_VOICE_SPEED_PRESETS[sVoice] || nextItem.speed || 1.0;
                allRequests.push(generateAndPreload(nextItem.text, sVoice, sSpeed));
            }

            // Mark as prefetched BEFORE request completes (optimistic)
            prefetchedIndicesRef.current.add(targetIndex);
        }

        // Fire all requests in parallel (silent fail)
        if (allRequests.length > 0) {
            console.log(`[Drive Prefetch] Loading ${allRequests.length} audio(s) for indices after ${currentIndex}`);
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
