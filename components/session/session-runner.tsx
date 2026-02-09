/**
 * SessionRunner - 会话运行器组件 (重构版)
 * 
 * 功能：
 *   - 组装层，协调 Hooks 和 Renderers
 *   - 支持客户端异步加载
 *   - 实现无限流式加载
 *   - 支持客户端进度持久化
 * 
 * 重构自原 711 行版本，现约 150 行
 */
'use client';

import { useRouter } from 'next/navigation';
import { SessionMode } from '@/types/briefing';

// --- Hooks ---
import { useDrillSession } from '@/hooks/use-drill-session';
import { useDrillAudio } from '@/hooks/use-drill-audio';

// --- Renderers ---
import { SyntaxRenderer, SyntaxFooter } from './renderers/syntax-renderer';
import { ChunkingRenderer } from './renderers/chunking-renderer';
import { AudioRenderer } from './renderers/audio-renderer';
import { ContextRenderer } from './renderers/context-renderer';

// --- UI Components ---
import { SessionSkeleton } from './session-skeleton';
import { BlitzSession } from './blitz-session';
import { UniversalCard } from '@/components/drill/universal-card';
import { Button } from '@/components/ui/button';
import { BriefingPayload } from '@/types/briefing';

interface SessionRunnerProps {
    initialPayload?: BriefingPayload[];
    userId: string;
    mode: SessionMode;
}

// --- Mode to Variant Mapping ---
const variantMap: Record<string, 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'pink'> = {
    SYNTAX: 'emerald',
    CHUNKING: 'blue',
    NUANCE: 'pink',
    BLITZ: 'violet',
    AUDIO: 'amber',
    READING: 'emerald',
    VISUAL: 'pink',
    PHRASE: 'violet',
    CONTEXT: 'rose',
};

export function SessionRunner({ initialPayload, userId, mode }: SessionRunnerProps) {
    const router = useRouter();

    // --- Core State Machine ---
    const session = useDrillSession({
        userId,
        mode,
        initialPayload,
    });

    // --- Audio Control (只在 AUDIO 模式激活) ---
    const audio = useDrillAudio({
        enabled: mode === 'AUDIO',
        currentDrill: session.currentDrill,
        queue: session.queue,
        index: session.index,
        completed: session.completed,
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
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-4">
                <h2 className="text-xl font-bold text-destructive">任务失败</h2>
                <p className="text-muted-foreground">暂无可用训练，请稍后重试。</p>
                <Button onClick={() => router.push('/dashboard')}>
                    返回基地
                </Button>
            </div>
        );
    }

    // --- Early Return: Completed ---
    if (session.completed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold">训练完成！</h2>
                <p className="text-muted-foreground">今日已掌握 {session.index + 1} 个训练。</p>
                <Button onClick={() => router.push('/dashboard')}>
                    返回控制台
                </Button>
            </div>
        );
    }

    // --- Safety Check ---
    if (!session.currentDrill) {
        return <SessionSkeleton mode={mode} />;
    }

    const variant = variantMap[mode] || 'violet';

    // --- CONTEXT Mode: Self-contained ---
    if (mode === 'CONTEXT') {
        return (
            <ContextRenderer
                drill={session.currentDrill}
                progress={session.progress}
                onGrade={(g) => session.handleComplete(g)}
            />
        );
    }

    // --- AUDIO Mode: Self-contained ---
    if (mode === 'AUDIO') {
        return (
            <AudioRenderer
                drill={session.currentDrill}
                index={session.index}
                total={session.queue.length}
                isPlaying={audio.isPlaying}
                onTogglePlay={audio.togglePlay}
                onGrade={(g) => session.handleComplete(g)}
            />
        );
    }

    // --- CHUNKING Mode: Special layout ---
    if (mode === 'CHUNKING') {
        return (
            <div className="bg-zinc-50 dark:bg-zinc-950 h-screen w-full relative">
                <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-violet-900/20 from-transparent via-transparent to-transparent pointer-events-none z-0" />
                <div className="relative z-10 h-full">
                    <UniversalCard
                        variant="blue"
                        category={`${mode} DRILL`}
                        progress={session.progress}
                        onExit={() => router.push('/dashboard')}
                        footer={null}
                        clean={true}
                        contentClassName="p-0 bg-transparent border-none shadow-none max-w-none w-full h-full"
                    >
                        <ChunkingRenderer
                            drill={session.currentDrill}
                            index={session.index}
                            onComplete={session.handleNext}
                        />
                    </UniversalCard>
                </div>
            </div>
        );
    }

    // --- Standard Modes: SYNTAX, PHRASE, etc. ---
    return (
        <div className="bg-zinc-50 dark:bg-zinc-950 h-screen w-full relative">
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-violet-900/20 from-transparent via-transparent to-transparent pointer-events-none z-0" />

            <div className="relative z-10 h-full">
                <UniversalCard
                    variant={variant}
                    category={`${mode} DRILL`}
                    progress={session.progress}
                    onExit={() => router.push('/dashboard')}
                    footer={
                        <SyntaxFooter
                            drill={session.currentDrill}
                            status={session.status}
                            selectedOption={session.selectedOption}
                            onOptionSelect={session.handleOptionSelect}
                            onNext={session.handleNext}
                            onComplete={session.handleComplete}
                            setStatus={session.setStatus}
                            variant={variant}
                        />
                    }
                    contentClassName="h-[60dvh] w-full flex flex-col justify-center"
                >
                    <SyntaxRenderer
                        drill={session.currentDrill}
                        index={session.index}
                        status={session.status}
                        selectedOption={session.selectedOption}
                        onOptionSelect={session.handleOptionSelect}
                        onNext={session.handleNext}
                        onComplete={session.handleComplete}
                        setStatus={session.setStatus}
                        variant={variant}
                    />
                </UniversalCard>
            </div>
        </div>
    );
}
