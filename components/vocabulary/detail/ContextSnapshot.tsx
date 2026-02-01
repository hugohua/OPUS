'use client';

/**
 * ContextSnapshot Component
 * 
 * 展示 L2 语境例句，支持切换场景和音频播放
 * 数据来源: SmartContent 表 (AI 生成)
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import { RefreshCw, Play, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/use-tts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    getOrGenerateL2Context,
    switchL2Scenario,
    getSmartContentAudio
} from "@/actions/content-generator";

interface ContextSnapshotProps {
    vocabId: number;
    mainWord: string;
    definition?: string;
}

interface ContentState {
    id?: string;
    text: string;
    translation: string;
    scenario: string;
    audioUrl: string | null;
}

export function ContextSnapshot({ vocabId, mainWord, definition }: ContextSnapshotProps) {
    const [content, setContent] = useState<ContentState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const tts = useTTS();

    // 初始化加载
    useEffect(() => {
        let cancelled = false;

        async function loadContent() {
            setIsLoading(true);
            try {
                const result = await getOrGenerateL2Context(vocabId, mainWord, definition);
                if (!cancelled) {
                    setContent({
                        id: result.id,
                        text: result.text,
                        translation: result.translation,
                        scenario: result.scenario,
                        audioUrl: result.audioUrl,
                    });
                }
            } catch (error) {
                console.error('Failed to load L2 context:', error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        loadContent();
        return () => { cancelled = true; };
    }, [vocabId, mainWord, definition]);

    // 音频轮询 (每 2s 检查一次，最多 30 次 / 60 秒)
    const [pollCount, setPollCount] = useState(0);
    const MAX_POLL_ATTEMPTS = 30;

    useEffect(() => {
        if (!content?.id || content.audioUrl || pollCount >= MAX_POLL_ATTEMPTS) return;

        const interval = setInterval(async () => {
            const { audioUrl } = await getSmartContentAudio(content.id!);
            if (audioUrl) {
                setContent(prev => prev ? { ...prev, audioUrl } : null);
            } else {
                setPollCount(prev => prev + 1);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [content?.id, content?.audioUrl, pollCount]);

    // 切换场景
    const handleSwitch = useCallback(() => {
        startTransition(async () => {
            try {
                const result = await switchL2Scenario(vocabId, mainWord, content?.scenario);
                setContent({
                    id: result.id,
                    text: result.text,
                    translation: result.translation,
                    scenario: result.scenario,
                    audioUrl: result.audioUrl,
                });
                setPollCount(0); // 重置轮询计数
            } catch (error) {
                console.error('Failed to switch scenario:', error);
            }
        });
    }, [vocabId, mainWord, content?.scenario]);

    // 播放音频
    const handlePlay = useCallback(() => {
        if (!content?.text) return;

        // 优先使用缓存的 URL，否则实时生成
        if (content.audioUrl) {
            // 直接播放缓存音频
            const audio = new Audio(content.audioUrl);
            audio.play();
        } else {
            // 调用 TTS Hook 实时生成
            tts.play({
                text: content.text,
                voice: "Cherry",
                language: "en-US",
                speed: 1.0
            });
        }
    }, [content, tts]);

    // Helper to highlight
    const highlightWord = (text: string, word: string) => {
        const parts = text.split(new RegExp(`(${word})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === word.toLowerCase()
                ? <span key={i} className="text-violet-400 font-bold">{part}</span>
                : part
        );
    };

    return (
        <section className="mb-8 px-1">
            <div className="flex justify-between items-end mb-3 pl-1">
                <h3 className="text-[10px] font-mono font-bold text-violet-400 uppercase tracking-widest">
                    L2 • Context Snapshot
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwitch}
                    disabled={isPending || isLoading}
                    className="h-6 text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors disabled:opacity-50 px-2"
                >
                    <RefreshCw className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
                    Switch Scenario
                </Button>
            </div>

            <div className="relative group cursor-pointer">
                {/* Vertical Line */}
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-violet-500 rounded-full"></div>

                <div className="pl-4 py-1">
                    {isLoading ? (
                        // 骨架屏
                        <div className="p-4 bg-white/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                            <Skeleton className="h-4 w-24 mb-3" />
                            <Skeleton className="h-5 w-full mb-2" />
                            <Skeleton className="h-5 w-3/4" />
                        </div>
                    ) : content ? (
                        <div className="relative p-4 bg-white/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-violet-500/30 transition-colors shadow-sm dark:shadow-none">
                            {/* Compact Play Button (Top-Right) */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                                disabled={tts.isLoading}
                                className="absolute top-2 right-2 rounded-full w-7 h-7 text-zinc-400 hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-900/30 transition-colors"
                            >
                                {tts.isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                )}
                            </Button>

                            <div className="flex items-center gap-2 mb-2 pr-8">
                                <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-[9px] font-bold text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                                    {content.scenario}
                                </span>
                                {!content.audioUrl && (
                                    <span className="text-[9px] text-zinc-400 dark:text-zinc-600 flex items-center gap-1">
                                        <Loader2 className="w-2 h-2 animate-spin" />
                                        音频生成中...
                                    </span>
                                )}
                            </div>

                            {/* English Sentence */}
                            <p className="text-sm text-zinc-700 dark:text-zinc-200 italic leading-relaxed font-serif mb-1.5">
                                "{highlightWord(content.text, mainWord)}"
                            </p>

                            {/* Chinese Translation */}
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {content.translation}
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-white/50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                            <span className="text-zinc-400 dark:text-zinc-500 text-sm">No context available.</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
