/**
 * SessionRunner - 会话运行器组件
 * 功能：
 *   管理 Drill 队列、用户交互、进度追踪
 *   支持客户端异步加载（避免 SSR 阻塞）
 *   实现无限流式加载（Lazy Loading）
 *   [New] 支持客户端进度持久化（刷新恢复）
 */
'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { EditorialDrill } from "@/components/briefing/editorial-drill";
import { SessionSkeleton } from "@/components/session/session-skeleton";
import { BlitzSession } from "@/components/session/blitz-session";
import { PhraseCard } from "@/components/briefing/phrase-card";
import { recordOutcome } from '@/actions/record-outcome';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { saveSession, loadSession, clearSession } from '@/lib/client/session-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { UniversalCard } from '@/components/drill/universal-card';

interface SessionRunnerProps {
    initialPayload?: BriefingPayload[];
    userId: string;
    mode: SessionMode;
}

const LOAD_THRESHOLD = 10; // 剩余 10 张时触发加载更多
const BATCH_LIMIT = 10;   // 每批加载数量

export function SessionRunner({ initialPayload, userId, mode }: SessionRunnerProps) {
    if (mode === 'BLITZ') {
        return <BlitzSession userId={userId} />;
    }

    const router = useRouter();

    // --- State Management ---
    const [queue, setQueue] = useState<BriefingPayload[]>(initialPayload || []);
    // isInitialLoading: 如果没有 active queue，则为 true
    const [isInitialLoading, setIsInitialLoading] = useState(queue.length === 0);

    const [index, setIndex] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<string | null>(null);

    // Track loaded VocabIDs to exclude them in next fetch
    const loadedVocabIds = useRef<Set<number>>(new Set());

    // [Time-Based Grading] Response Timer
    const startTime = useRef<number>(Date.now());

    // --- 1. 挂载时：恢复状态 or 初始加载 ---
    useEffect(() => {
        // 如果外部传入了 payload (SSR case, unlikely now but possible)，则不恢复
        if (initialPayload && initialPayload.length > 0) {
            initVocabSet(initialPayload);
            return;
        }

        const restore = () => {
            const saved = loadSession(userId, mode);
            if (saved && saved.queue.length > 0 && saved.currentIndex < saved.queue.length) {
                console.log('Session restored from storage', saved);
                setQueue(saved.queue);
                setIndex(saved.currentIndex);
                initVocabSet(saved.queue);
                setIsInitialLoading(false);
                toast.success('已恢复上次进度', { duration: 2000 });
            } else {
                // 无存档或已过期，发起新请求
                loadInitialData();
            }
        };

        restore();
    }, []); // Run once on mount

    const initVocabSet = (items: BriefingPayload[]) => {
        items.forEach(p => {
            const vid = (p.meta as any).vocabId;
            if (vid) loadedVocabIds.current.add(vid);
        });
    };

    // --- 2. 状态变更同步到 Storage ---
    useEffect(() => {
        if (queue.length > 0 && !completed) {
            saveSession(userId, mode, queue, index);
        }
    }, [queue, index, completed, userId, mode]);

    const loadInitialData = async () => {
        try {
            const res = await getNextDrillBatch({
                userId,
                mode,
                limit: BATCH_LIMIT,
                excludeVocabIds: []
            });

            if (res.status === 'success' && res.data && res.data.length > 0) {
                const newItems = res.data;
                initVocabSet(newItems);
                setQueue(newItems);
                // 保存数据来源
                console.log('🔍 API Response meta:', res.meta); // 调试日志
                if (res.meta?.source) {
                    console.log('🔍 Setting dataSource to:', res.meta.source); // 调试日志
                    setDataSource(res.meta.source);
                }
            } else {
                toast.error('加载训练数据失败');
            }
        } catch (e) {
            toast.error('网络错误，请重试');
        } finally {
            setIsInitialLoading(false);
        }
    };

    const currentDrill = queue[index];
    const countDisplay = index + 1;

    // 切换到下一题时重置状态
    useEffect(() => {
        setStatus("idle");
        setSelectedOption(null);
        // Reset Timer
        startTime.current = Date.now();
    }, [index]);

    // --- 懒加载逻辑 ---
    useEffect(() => {
        if (isInitialLoading) return; // 初始加载完成后才启用

        const remaining = queue.length - index;
        if (remaining <= LOAD_THRESHOLD && !isLoadingMore) {
            loadMore();
        }
    }, [index, queue.length, isLoadingMore, isInitialLoading]);

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
                initVocabSet(newItems);
                setQueue(prev => [...prev, ...newItems]);
                toast.success('新弹药已就位！', { duration: 1000 });
            }
        } catch (e) {
            // 静默失败
        } finally {
            setIsLoadingMore(false);
        }
    };

    const textSegment = currentDrill?.segments.find(s => s.type === 'text');
    const interactSegment = currentDrill?.segments.find(s => s.type === 'interaction');

    const handleComplete = async (result: boolean | number) => {
        const vocabId = (currentDrill.meta as any).vocabId || 0;

        let grade = 1;
        let isCorrect = false;

        if (typeof result === 'number') {
            grade = result;
            isCorrect = grade >= 3;
        } else {
            isCorrect = result;
            grade = isCorrect ? 3 : 1;
        }

        const duration = Date.now() - startTime.current;
        const isRetry = (currentDrill.meta as any).isRetry;

        // 静默记录结果
        recordOutcome({
            userId,
            vocabId,
            grade: grade as any,
            mode,
            duration,
            isRetry
        }).catch(() => { });

        // [Session Loop] 错题闭环逻辑
        if (!isCorrect) {
            // 1. Clone Current Drill
            const retryDrill = JSON.parse(JSON.stringify(currentDrill)) as BriefingPayload;

            // 2. Mark as Retry
            if (!retryDrill.meta) retryDrill.meta = {} as any;
            (retryDrill.meta as any).isRetry = true;

            // 3. Insert into Queue (Expansion)
            // Insert at current + 5, or end of queue if length < 5
            const insertIndex = Math.min(queue.length, index + 5);

            setQueue(prev => {
                const next = [...prev];
                next.splice(insertIndex, 0, retryDrill);
                return next;
            });

            // Optional: Toast feedback for "Review later"
            // toast.info('Missed! Added to review queue.', { duration: 1500 });
        }

        // 进入下一题
        if (index < queue.length - 1) {
            setIndex(i => i + 1);
        } else {
            // 队列结束 -> 清除 Storage
            clearSession(userId, mode);
            setCompleted(true);
        }
    };

    const handleOptionSelect = (option: string) => {
        if (status !== "idle") return;
        const answerKey = interactSegment?.task?.answer_key;
        if (!answerKey) return;

        setSelectedOption(option);

        // Robust comparison: Trim + Lowercase
        const normalize = (s: string) => s.trim().toLowerCase();
        const isCorrect = normalize(option) === normalize(answerKey);

        // Debug Log
        console.log(`[Grading] Selected: "${option}" | Key: "${answerKey}" | Match: ${isCorrect}`);

        setStatus(isCorrect ? "correct" : "wrong");
    };

    const handleNextDrill = () => {
        const answerKey = interactSegment?.task?.answer_key;
        if (!answerKey) return;

        const isCorrect = selectedOption === answerKey;
        handleComplete(isCorrect);
    };

    // --- 初始加载中显示骨架屏 ---
    if (isInitialLoading) {
        return <SessionSkeleton mode={mode} />;
    }

    // --- 队列为空（加载失败）---
    if (queue.length === 0) {
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

    // --- 会话完成 ---
    if (completed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold">训练完成！</h2>
                <p className="text-muted-foreground">今日已掌握 {index + 1} 个训练。</p>
                <Button onClick={() => router.push('/dashboard')}>
                    返回控制台
                </Button>
            </div>
        );
    }

    if (!currentDrill) return <SessionSkeleton mode={mode} />;

    if (!currentDrill) return <SessionSkeleton mode={mode} />;

    // Map mode to color variant
    const variantMap: Record<string, "violet" | "emerald" | "amber" | "rose" | "blue" | "pink"> = {
        SYNTAX: "emerald",
        CHUNKING: "blue",
        NUANCE: "pink",
        BLITZ: "violet",
        AUDIO: "amber",
        READING: "emerald",
        VISUAL: "pink"
    };

    const variant = variantMap[mode] || "violet";
    const isPhraseMode = mode === 'PHRASE';

    const PhraseFooter = status === 'idle' ? (
        <div className="w-full flex items-center justify-center pb-12">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] animate-pulse">
                Tap anywhere to reveal
            </p>
            {/* Invisible large click area handled by parent, or just a button here if needed. 
                Snippet implies "How well did you know this?" appears AFTER reveal.
                But user needs to REVEAL first.
                Let's use a transparent overlay or a button. To match the snippet, the footer is empty initially?
                Actually, let's keep the "Show Answer" button for clarity, or make it minimal.
            */}
            <Button
                onClick={() => setStatus('correct')}
                variant="ghost"
                className="absolute inset-0 w-full h-full z-10 opacity-0 cursor-default"
            >
                Reveal
            </Button>
        </div>
    ) : (
        <div className="w-full shrink-0 pb-12">
            <div className="text-center mb-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] animate-pulse">
                    How well did you know this?
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-lg mx-auto">
                {/* 1. Forgot */}
                <button
                    onClick={() => handleComplete(1)}
                    className="group flex flex-col items-center gap-2"
                >
                    <div className="w-full h-20 rounded-2xl bg-zinc-900 border border-zinc-800 group-hover:border-rose-500/50 group-hover:bg-rose-900/10 flex items-center justify-center transition-all active:scale-95 shadow-lg">
                        <svg className="w-8 h-8 text-zinc-500 group-hover:text-rose-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2h4" /><path d="M12 14v-4" /><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1 0 16v-1a7 7 0 0 0-7-7h-.72" /></svg>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-rose-400 uppercase tracking-wider">Forgot</span>
                </button>

                {/* 2. Hazy (Blurry) */}
                <button
                    onClick={() => handleComplete(2)}
                    className="group flex flex-col items-center gap-2"
                >
                    <div className="w-full h-20 rounded-2xl bg-zinc-900 border border-zinc-800 group-hover:border-amber-500/50 group-hover:bg-amber-900/10 flex items-center justify-center transition-all active:scale-95 shadow-lg">
                        <svg className="w-8 h-8 text-zinc-500 group-hover:text-amber-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12c0-4.4 3.6-8 8-8 1.2 0 2.4.3 3.4.8" /><path d="M18.4 6.6a9 9 0 0 1 3.6 5.4c0 4.4-3.6 8-8 8-1.2 0-2.4-.3-3.4-.8" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-amber-400 uppercase tracking-wider">Hazy</span>
                </button>

                {/* 3. Know */}
                <button
                    onClick={() => handleComplete(3)}
                    className="group flex flex-col items-center gap-2"
                >
                    <div className="w-full h-20 rounded-2xl bg-zinc-900 border border-zinc-800 group-hover:border-emerald-500/50 group-hover:bg-emerald-900/10 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
                        <svg className="w-8 h-8 text-zinc-500 group-hover:text-emerald-500 transition-colors" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                    <span className="text-xs font-bold text-zinc-500 group-hover:text-emerald-400 uppercase tracking-wider">Know</span>
                </button>
            </div>
        </div>
    );

    // --- Standard Mode Footer (2x2 Grid) ---

    // Footer Content (Buttons)
    const FooterContent = (
        <div className="w-full flex flex-col items-center justify-end">
            {status === "idle" && (
                <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6">Select the best option</p>
            )}

            <div className="w-full grid grid-cols-2 gap-4 h-48">
                {status === "idle" ? (
                    // Options Grid
                    interactSegment?.task?.options?.map((opt, idx) => {
                        const indexLabel = String.fromCharCode(65 + idx); // A, B, C...
                        return (
                            <button
                                key={opt}
                                onClick={() => handleOptionSelect(opt)}
                                className="group relative h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 active:scale-[0.96] transition-all flex flex-col items-center justify-center gap-3"
                            >
                                <span className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-xs font-mono text-zinc-400 flex items-center justify-center group-hover:border-emerald-200 group-hover:text-emerald-600 transition-colors">
                                    {indexLabel}
                                </span>
                                <span className="font-serif text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200">
                                    {opt}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    // Next Button (Full Width)
                    <div className="col-span-2 flex items-center justify-center h-full">
                        <Button
                            onClick={handleNextDrill}
                            className={cn(
                                "w-full h-20 text-xl font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-[2rem]",
                                variant === 'violet' ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/20" :
                                    variant === 'emerald' ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20" :
                                        variant === 'blue' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20" :
                                            "bg-zinc-900 text-white hover:bg-zinc-800"
                            )}
                        >
                            Next Challenge <ArrowLeft className="w-6 h-6 ml-2 rotate-180" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );

    // Choose Footer based on mode
    const ActiveFooter = isPhraseMode ? PhraseFooter : FooterContent;

    return (
        <div className="bg-zinc-50 dark:bg-zinc-950 h-screen w-full relative">
            {/* Dark Mode Ambient Glow */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none z-0" />

            {/* Fallback/Loading Layer if needed, but UniversalCard handles the main shell */}
            <div className="relative z-10 h-full">

                <UniversalCard
                    variant={variant}
                    category={`${mode} DRILL`}
                    progress={queue.length > 0 ? ((index + 1) / queue.length) * 100 : 0}
                    onExit={() => router.push('/dashboard')}
                    footer={ActiveFooter}
                >
                    {/* Body Content */}
                    {textSegment && interactSegment && (
                        <div className="w-full">
                            {/* DataSource Indicator */}
                            {dataSource === 'deterministic' && (
                                <div className="mb-6 flex justify-center">
                                    <span className="inline-flex items-center rounded-md bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-400/20">
                                        Offline Backup
                                    </span>
                                </div>
                            )}

                            {isPhraseMode ? (
                                <PhraseCard
                                    phraseMarkdown={textSegment.content_markdown || ""}
                                    translation={(textSegment as any).translation_cn || ""}
                                    wordDefinition={(interactSegment.task as any).explanation_markdown?.split('\n')[0] || ""} // Extract first line definition
                                    status={status as any} // Cast status "correct"->"revealed" logic handled in component
                                    phonetic={(interactSegment.task as any).explanation_markdown?.match(/\[(.*?)\]/)?.[0] || ""}
                                    partOfSpeech={(interactSegment.task as any).explanation_markdown?.split(']')[1]?.trim() || ""}
                                />
                            ) : (
                                <EditorialDrill
                                    content={textSegment.content_markdown || ""}
                                    translation={(textSegment as any).translation_cn}
                                    explanation={(interactSegment.task as any).explanation_markdown}
                                    answer={interactSegment.task?.answer_key || ""}
                                    status={status}
                                    selected={selectedOption}
                                />
                            )}

                            {/* Prompt */}
                            {!isPhraseMode && status === "idle" && (
                                <p className="mt-8 text-center font-mono text-[10px] text-zinc-500 uppercase tracking-widest animate-pulse">
                                    Select the best option
                                </p>
                            )}
                        </div>
                    )}
                </UniversalCard>
            </div>
        </div>
    );
}
