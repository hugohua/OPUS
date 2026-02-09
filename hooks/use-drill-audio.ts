/**
 * useDrillAudio - 音频控制 Hook
 * 
 * 功能：
 *   - 封装 useTTS 调用
 *   - 管理音频预加载 (Prefetch Lookahead)
 *   - 自动播放当前 Drill 音频
 *   - 仅在 AUDIO 模式时激活
 * 
 * 从 session-runner.tsx 抽离
 */

import { useCallback, useRef, useEffect } from 'react';
import { BriefingPayload } from '@/types/briefing';
import { useTTS } from '@/hooks/use-tts';
import {
    DEFAULT_TTS_VOICE,
    DEFAULT_TTS_SPEED,
    DEFAULT_TTS_LANGUAGE,
    AUDIO_PREFETCH_LOOKAHEAD
} from '@/config/audio';

// --- Types ---
export interface UseDrillAudioOptions {
    enabled: boolean; // mode === 'AUDIO'
    currentDrill: BriefingPayload | null;
    queue: BriefingPayload[];
    index: number;
    completed: boolean;
}

export interface DrillAudioState {
    isPlaying: boolean;
    play: (options: { text: string; voice?: string; speed?: number }) => void;
    stop: () => void;
    togglePlay: () => void;
}

export function useDrillAudio(options: UseDrillAudioOptions): DrillAudioState {
    const { enabled, currentDrill, queue, index, completed } = options;

    const tts = useTTS();

    // Prefetch tracking
    const prefetchedIndicesRef = useRef<Set<number>>(new Set());
    const preloadedAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

    // --- Helper: Generate and Preload Audio ---
    const generateAndPreload = useCallback(async (script: string, voice: string) => {
        try {
            const res = await fetch('/api/tts/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: script, voice, language: 'en-US', speed: 1.0 })
            });
            if (!res.ok) return;

            const { url } = await res.json();
            if (!url || preloadedAudiosRef.current.has(url)) return;

            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.load();
            preloadedAudiosRef.current.set(url, audio);
        } catch {
            // 静默失败，不影响主流程
        }
    }, []);

    // --- Action: Prefetch Next Items ---
    const prefetchNextItems = useCallback(() => {
        if (!enabled) return;

        for (let offset = 1; offset <= AUDIO_PREFETCH_LOOKAHEAD; offset++) {
            const targetIndex = index + offset;
            if (targetIndex >= queue.length) break;
            if (prefetchedIndicesRef.current.has(targetIndex)) continue;

            const nextDrill = queue[targetIndex];
            const textSeg = nextDrill?.segments.find(s => s.type === 'text');
            const script = (textSeg as any)?.audio_text || textSeg?.content_markdown || "";
            const voice = (nextDrill?.meta?.sender_voice as string) || DEFAULT_TTS_VOICE;

            if (script) {
                prefetchedIndicesRef.current.add(targetIndex);
                generateAndPreload(script, voice);
            }
        }
    }, [enabled, index, queue, generateAndPreload]);

    // --- Effect: Auto-Play Current Drill ---
    useEffect(() => {
        if (!enabled || !currentDrill || completed) return;

        // Stop previous audio immediately
        tts.stop();

        const textSeg = currentDrill.segments.find(s => s.type === 'text');
        const script = (textSeg as any)?.audio_text || textSeg?.content_markdown || "";

        if (script) {
            const timer = setTimeout(() => {
                tts.play({
                    text: script,
                    voice: (currentDrill.meta?.sender_voice as string) || DEFAULT_TTS_VOICE,
                    speed: DEFAULT_TTS_SPEED,
                });
            }, 500);

            return () => {
                clearTimeout(timer);
                tts.stop();
            };
        }

        return () => {
            tts.stop();
        };
    }, [index, enabled, currentDrill, completed]);

    // --- Effect: Prefetch Trigger ---
    useEffect(() => {
        if (enabled && !completed && queue.length > 0) {
            const timer = setTimeout(prefetchNextItems, 500);
            return () => clearTimeout(timer);
        }
    }, [index, enabled, queue.length, completed, prefetchNextItems]);

    // --- Action: Toggle Play ---
    const togglePlay = useCallback(() => {
        if (!currentDrill) return;

        if (tts.isPlaying) {
            tts.stop();
        } else {
            const textSeg = currentDrill.segments.find(s => s.type === 'text');
            const script = (textSeg as any)?.audio_text || textSeg?.content_markdown || "";
            if (script) {
                tts.play({ text: script, voice: DEFAULT_TTS_VOICE });
            }
        }
    }, [currentDrill, tts]);

    return {
        isPlaying: tts.isPlaying,
        play: tts.play,
        stop: tts.stop,
        togglePlay,
    };
}
