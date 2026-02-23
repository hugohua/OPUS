/**
 * SessionRunner - Focus Shell Implementation
 * 
 * Refactored to remove UniversalCard wrappers (as Renderers now use FocusShell).
 */
'use client';

import { useRouter } from 'next/navigation';
import { SessionMode } from '@/types/briefing';
import { FocusShellVariant } from '@/components/drill/focus-shell';

// --- Hooks ---
import { useDrillSession } from '@/hooks/use-drill-session';
import { useDrillAudio } from '@/hooks/use-drill-audio';

// --- Renderers ---
import { SyntaxRenderer } from './renderers/syntax-renderer';
import { ChunkingRenderer } from './renderers/chunking-renderer';
import { AudioRenderer } from './renderers/audio-renderer';
import { ContextRenderer } from './renderers/context-renderer';

// --- UI Components ---
import { SessionSkeleton } from './session-skeleton';
import { BlitzSession } from './blitz-session';
import { Button } from '@/components/ui/button';
import { BriefingPayload } from '@/types/briefing';
import React from 'react';
import { useSharedUserSettings } from '@/components/providers/user-settings-provider';
import { useAudioPreload } from '@/hooks/use-audio-preload';
import { DEFAULT_TTS_VOICE, DEFAULT_TTS_SPEED } from '@/config/audio';

interface SessionRunnerProps {
    initialPayload?: BriefingPayload[];
    userId: string;
    mode: SessionMode;
    grammarNodeId?: string; // [Quick Drill] 靶向语法训练
}

// --- Mode to Variant Mapping (Still useful for passing to renderers if needed) ---
const variantMap: Record<SessionMode, 'L0' | 'L1' | 'L2'> = {
    'SYNTAX': 'L0',
    'PHRASE': 'L0',
    'BLITZ': 'L0',
    'AUDIO': 'L1',
    'CHUNKING': 'L1',
    'CONTEXT': 'L2',
    'NUANCE': 'L2',
    'L0_MIXED': 'L0',
    'L1_MIXED': 'L1',
    'L2_MIXED': 'L2',
    'DAILY_BLITZ': 'L0', // Hybrid requires special handling
    'READING': 'L2',      // Arbitrary fallback
    'VISUAL': 'L0',
    'ARENA_PART5': 'L0', // 复用 L0 Syntax 选项样式
    'ARENA_PART6': 'L0' // 复用 L0 选项样式
};

export function SessionRunner({ initialPayload, userId, mode, grammarNodeId }: SessionRunnerProps) {
    const router = useRouter();

    // --- Core State Machine ---
    const session = useDrillSession({
        userId,
        mode,
        initialPayload,
        grammarNodeId,
    });

    // --- Audio Control ---
    const audio = useDrillAudio({
        enabled: mode === 'AUDIO',
        currentDrill: session.currentDrill,
        queue: session.queue,
        index: session.index,
        completed: session.completed,
    });

    // --- Audio Preload Integration (Global) ---
    const { autoPlay } = useSharedUserSettings();

    // Arena 实战模式（Part5/6）不需要 TTS 预加载，仅背单词模式才触发
    const ARENA_MODES: SessionMode[] = ['ARENA_PART5', 'ARENA_PART6'];
    const needsAudioPreload = autoPlay && !ARENA_MODES.includes(mode);

    const extractSessionAudio = React.useCallback((item: BriefingPayload) => {
        const segments = item.segments || [];
        const textSegments = segments.filter(s => s.type === 'text');

        return textSegments.map(s => {
            // Strip structural tags like <s>, <v>, <o>, <chunk>
            const rawText = s.content_markdown || "";
            const cleanText = rawText.replace(/<\/?(?:s|v|o|chunk)>/g, "");
            return {
                text: cleanText,
                voice: DEFAULT_TTS_VOICE,
                speed: DEFAULT_TTS_SPEED
            };
        });
    }, []);

    useAudioPreload<BriefingPayload>({
        items: session.queue,
        currentIndex: session.index,
        extractTextFn: extractSessionAudio,
        lookahead: 3,
        enabled: needsAudioPreload
    });

    // --- Early Return: BLITZ Mode ---
    if (mode === 'BLITZ') {
        return <BlitzSession userId={userId} />;
    }

    // --- Early Return: Initial Loading ---
    if (session.isInitialLoading) {
        return <SessionSkeleton mode={mode} />;
    }

    // --- Early Return: Empty Queue ---
    if (session.queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-4 bg-zinc-50 dark:bg-zinc-950">
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">暂无可用训练</h2>
                <p className="text-zinc-500">请稍后再试。</p>
                <Button onClick={() => router.push('/dashboard')}>
                    返回主页
                </Button>
            </div>
        );
    }

    // --- Early Return: Completed ---
    if (session.completed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-4 bg-zinc-50 dark:bg-zinc-950">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">训练完成！</h2>
                <p className="text-zinc-500">本次掌握 {session.index + 1} 个词汇。</p>
                <Button onClick={() => router.push('/dashboard')}>
                    返回主页
                </Button>
            </div>
        );
    }

    // --- Safety Check ---
    if (!session.currentDrill) {
        return <SessionSkeleton mode={mode} />;
    }

    const variant = variantMap[mode] || 'L2'; // Default safe fallback
    const total = session.queue.length;

    // --- RENDERERS (Direct Return - FocusShell handles layout) ---

    // 1. CONTEXT
    if (mode === 'CONTEXT') {
        return (
            <ContextRenderer
                drill={session.currentDrill}
                progress={session.progress}
                onGrade={(g) => session.handleComplete(g)}
            />
        );
    }

    // 2. AUDIO
    if (mode === 'AUDIO') {
        return (
            <AudioRenderer
                drill={session.currentDrill}
                index={session.index}
                total={total}
                isPlaying={audio.isPlaying}
                onTogglePlay={audio.togglePlay}
                onGrade={(g) => session.handleComplete(g)}
            />
        );
    }

    // 3. CHUNKING
    if (mode === 'CHUNKING') {
        return (
            <ChunkingRenderer
                drill={session.currentDrill}
                index={session.index}
                total={total}
                onComplete={session.handleNext}
            />
        );
    }

    // 4. STANDARD (SYNTAX, PHRASE, etc.)
    return (
        <SyntaxRenderer
            drill={session.currentDrill}
            index={session.index}
            totalDrills={total}
            status={session.status}
            selectedOption={session.selectedOption}
            onOptionSelect={session.handleOptionSelect}
            onNext={session.handleNext}
            onComplete={session.handleComplete}
            setStatus={session.setStatus}
            variant={variant}
        />
    );
}
