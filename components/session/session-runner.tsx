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
import { recordOutcome } from '@/actions/record-outcome';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { saveSession, loadSession, clearSession } from '@/lib/client/session-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Header } from '@/components/ui/header';

interface SessionRunnerProps {
    initialPayload?: BriefingPayload[];
    userId: string;
    mode: SessionMode;
}

const LOAD_THRESHOLD = 5; // 剩余 5 张时触发加载更多
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

    const handleComplete = async (isCorrect: boolean) => {
        const vocabId = (currentDrill.meta as any).vocabId || 0;
        const grade = isCorrect ? 3 : 1;
        const duration = Date.now() - startTime.current;
        const isRetry = (currentDrill.meta as any).isRetry;

        // 静默记录结果
        recordOutcome({
            userId,
            vocabId,
            grade,
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
        const isCorrect = option === answerKey;
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

    return (
        <div className="dark:bg-zinc-950 bg-zinc-50 relative h-screen w-full overflow-hidden font-sans antialiased flex flex-col transition-colors duration-300">

            {/* Background Glow Removed */}

            {/* 降级模式提示 */}
            {dataSource === 'deterministic' && (
                <div className="relative z-10 flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-500/20">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        简化模式 · AI 正在后台生成更丰富的内容
                    </span>
                </div>
            )}

            {/* Header */}
            <Header
                variant="drill"
                progress={queue.length > 0 ? ((index + 1) / queue.length) * 100 : 0}
                stepLabel={`${mode} DRILL ${countDisplay.toString().padStart(2, '0')}`}
                onBack={() => router.push('/dashboard')}
                rightAction={
                    isLoadingMore && (
                        <div className="w-10 h-10 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                        </div>
                    )
                }
                className="shrink-0"
            />

            {/* 主舞台 */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-start pt-12 md:pt-24 px-4 min-h-0 overflow-y-auto pb-4">
                {textSegment && interactSegment && (
                    <>
                        <EditorialDrill
                            content={textSegment.content_markdown || ""}
                            translation={(textSegment as any).translation_cn}
                            explanation={(interactSegment.task as any).explanation_markdown}
                            answer={interactSegment.task?.answer_key || ""}
                            status={status}
                            selected={selectedOption}
                        />
                        {/* 提示 */}
                        {status === "idle" && (
                            <p className="mt-6 font-mono text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                Fill in the missing verb
                            </p>
                        )}
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-20 w-full px-5 pb-[100px] pt-4 shrink-0 flex items-center gap-4 transition-all duration-300 ease-in-out min-h-[140px] items-end">
                {status === "idle" ? (
                    interactSegment?.task?.options?.map((opt) => (
                        <Button
                            key={opt}
                            onClick={() => handleOptionSelect(opt)}
                            className="flex-1 h-14 text-lg font-serif border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 active:scale-[0.98] shadow-sm"
                        >
                            {opt}
                        </Button>
                    ))
                ) : (
                    <Button
                        onClick={handleNextDrill}
                        className="w-full h-14 text-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20 animate-in fade-in slide-in-from-bottom-4 duration-300"
                    >
                        下一题 <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                    </Button>
                )}
            </footer>
        </div>
    );
}
