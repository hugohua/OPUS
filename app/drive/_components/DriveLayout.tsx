'use client';

/**
 * Drive 布局组件 (V3)
 * 
 * V3 变更：
 *   - 支持复习模式 + 选词数量切换
 *   - 移除分页逻辑 (cursor/hasMore/loadMore)
 *   - 播放完自动循环
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTTS } from '@/hooks/use-tts';
import { DriveItem, DRIVE_VOICE_CONFIG, DriveMode, DriveTrack, DRIVE_VOICE_SPEED_PRESETS, DashScopeVoice } from '@/lib/constants/drive';
import { ReviewModeId, BatchSize, DEFAULT_BATCH_SIZE, REVIEW_MODES } from '@/lib/constants/review-modes';
import { generateDrivePlaylist } from '@/actions/drive';
import { DriveHeader } from './DriveHeader';
import { DriveMain } from './DriveMain';
import { DriveControls } from './DriveControls';
import { useAudioPreload } from '@/hooks/use-audio-preload';
import { ReviewModePicker } from '@/components/shared/ReviewModePicker';

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
    reviewMode: ReviewModeId;
    batchSize: BatchSize;
    isLoading: boolean;
    ttsIsCached?: boolean;
    play: () => void;
    pause: () => void;
    next: () => void;
    prev: () => void;
    seek: (time: number) => void;
    openModePicker: () => void;
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
    track: DriveTrack;
    initialMode: ReviewModeId;
    initialBatchSize: BatchSize;
}

export function DriveLayout({
    initialPlaylist,
    track,
    initialMode,
    initialBatchSize,
}: DriveLayoutProps) {
    // 播放列表状态
    const [playlist, setPlaylist] = useState<DriveItem[]>(initialPlaylist);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 复习模式状态
    const [reviewMode, setReviewMode] = useState<ReviewModeId>(initialMode);
    const [batchSize, setBatchSize] = useState<BatchSize>(initialBatchSize);

    // Drawer 状态
    const [pickerOpen, setPickerOpen] = useState(false);

    // Playback State Machine
    const [playbackStage, setPlaybackStage] = useState<PlaybackStage>('idle');
    const stageTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // TTS Engine
    const tts = useTTS();

    // Derived Current Item
    const currentItem = playlist[currentIndex];

    // ------------------------------------------------------------------
    // 模式/数量切换 → 重新生成 Playlist
    // ------------------------------------------------------------------
    const handleModeChange = useCallback(async (newMode: ReviewModeId, newBatch: BatchSize) => {
        // 如果没有变化则不刷新
        if (newMode === reviewMode && newBatch === batchSize) return;

        setIsLoading(true);
        setIsPlaying(false);
        tts.stop();
        clearTimeout(stageTimeoutRef.current!);

        try {
            const res = await generateDrivePlaylist({ track, mode: newMode, batchSize: newBatch });
            setPlaylist(res.items);
            setCurrentIndex(0);
            setPlaybackStage('idle');
            setReviewMode(newMode);
            setBatchSize(newBatch);

        } catch (error) {
            console.error('[Drive] Mode change failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [reviewMode, batchSize, track, tts]);

    // ------------------------------------------------------------------
    // Core Orchestrator
    // ------------------------------------------------------------------

    // 1. Start Engine Trigger
    useEffect(() => {
        if (!isPlaying || !currentItem) {
            tts.stop();
            clearTimeout(stageTimeoutRef.current!);
            return;
        }

        if (playbackStage === 'idle') {
            startItemSequence(currentItem);
        }
    }, [isPlaying, currentIndex]);

    // 2. Sequence Logic
    const startItemSequence = (item: DriveItem) => {
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
        const finalSpeed = DRIVE_VOICE_SPEED_PRESETS[finalVoice] || currentItem.speed || 1.0;

        tts.play({
            text: text,
            voice: finalVoice,
            language: 'en-US',
            speed: finalSpeed
        });
    };

    // ------------------------------------------------------------------
    // Prefetch Logic
    // ------------------------------------------------------------------
    const extractDriveAudio = React.useCallback((item: DriveItem) => {
        const targets = [];
        if (item.mode === 'QUIZ') {
            const qVoice = DRIVE_VOICE_CONFIG.QUIZ_QUESTION;
            const qSpeed = DRIVE_VOICE_SPEED_PRESETS[qVoice] || item.speed || 1.0;
            targets.push({ text: item.word || item.text, voice: qVoice, speed: qSpeed });

            const aVoice = DRIVE_VOICE_CONFIG.QUIZ_ANSWER;
            const aSpeed = DRIVE_VOICE_SPEED_PRESETS[aVoice] || 1.0;
            targets.push({ text: item.trans, voice: aVoice, speed: aSpeed });
        } else if (item.mode === 'WASH') {
            const wVoice = DRIVE_VOICE_CONFIG.WASH_PHRASE;
            const wSpeed = DRIVE_VOICE_SPEED_PRESETS[wVoice] || item.speed || 1.0;
            targets.push({ text: item.text, voice: wVoice, speed: wSpeed });
        } else {
            const sVoice = DRIVE_VOICE_CONFIG.STORY;
            const sSpeed = DRIVE_VOICE_SPEED_PRESETS[sVoice] || item.speed || 1.0;
            targets.push({ text: item.text, voice: sVoice, speed: sSpeed });
        }
        return targets;
    }, []);

    useAudioPreload<DriveItem>({
        items: playlist,
        currentIndex,
        extractTextFn: extractDriveAudio,
        lookahead: 5,
        enabled: isPlaying
    });

    // 3. Stage Transition (On TTS End)
    const wasTTSPlayingRef = React.useRef(false);

    useEffect(() => {
        const isTTSPlaying = tts.status === 'playing';
        const isTTSIdle = tts.status === 'idle';

        if (wasTTSPlayingRef.current && isTTSIdle && isPlaying) {
            handleStageComplete();
        }

        wasTTSPlayingRef.current = isTTSPlaying;
    }, [tts.status, isPlaying]);

    const handleStageComplete = () => {
        if (!currentItem) return;

        if (currentItem.mode === 'QUIZ') {
            if (playbackStage === 'word') {
                setPlaybackStage('gap');
                stageTimeoutRef.current = setTimeout(() => {
                    setPlaybackStage('meaning');
                    playTTS(currentItem.trans, DRIVE_VOICE_CONFIG.QUIZ_ANSWER);
                }, 2500);
            } else if (playbackStage === 'meaning') {
                next();
            }
        } else if (currentItem.mode === 'WASH') {
            stageTimeoutRef.current = setTimeout(() => {
                next();
            }, 1000);
        } else {
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
        setPlaybackStage('idle');
        setCurrentIndex((prev) => (prev + 1) % playlist.length); // 循环播放
        setIsPlaying(true);
    };

    const prev = () => {
        clearTimeout(stageTimeoutRef.current!);
        setPlaybackStage('idle');
        setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
        setIsPlaying(true);
    };

    const openModePicker = () => setPickerOpen(true);

    return (
        <DriveContext.Provider value={{
            playlist,
            currentIndex,
            isPlaying,
            playbackStage,
            duration: tts.duration,
            currentTime: tts.currentTime,
            reviewMode,
            batchSize,
            isLoading,
            ttsIsCached: tts.isCached,
            play, pause, next, prev,
            seek: () => { },
            openModePicker,
        }}>
            <div className="relative w-full h-screen bg-background text-foreground overflow-hidden flex flex-col font-sans selection:bg-primary/30">
                <DriveHeader />
                <DriveMain />
                <DriveControls />

                {/* 模式选择 Drawer */}
                <ReviewModePicker
                    scene="drive"
                    currentMode={reviewMode}
                    currentBatchSize={batchSize}
                    onSelect={handleModeChange}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                />
            </div>
        </DriveContext.Provider>
    );
}
