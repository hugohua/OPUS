/**
 * useDrillSession - 核心状态机 Hook
 * 
 * 功能：
 *   - 管理 Drill 队列、索引、完成状态
 *   - 处理 Infinite Scroll (loadMore)
 *   - 处理评分逻辑 (handleComplete) + Retry Queue
 *   - 处理会话持久化 (恢复/保存)
 * 
 * 从 session-runner.tsx 抽离，提高可测试性和复用性
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { BriefingPayload, SessionMode } from '@/types/briefing';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { recordOutcome } from '@/actions/record-outcome';
import { saveSession, loadSession, clearSession } from '@/lib/client/session-store';
import { toast } from 'sonner';

// --- Constants ---
const LOAD_THRESHOLD = 10;
const BATCH_LIMIT = 10;

// --- Types ---
export interface UseDrillSessionOptions {
    userId: string;
    mode: SessionMode;
    initialPayload?: BriefingPayload[];
}

export interface DrillSessionState {
    // State
    queue: BriefingPayload[];
    index: number;
    status: 'idle' | 'correct' | 'wrong';
    completed: boolean;
    isInitialLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    selectedOption: string | null;
    currentDrill: BriefingPayload | null;
    progress: number;

    // Actions
    handleOptionSelect: (option: string) => void;
    handleComplete: (result: boolean | number) => Promise<void>;
    handleNext: () => void;
    setStatus: (status: 'idle' | 'correct' | 'wrong') => void;
    reset: () => void;
}

export function useDrillSession(options: UseDrillSessionOptions): DrillSessionState {
    const { userId, mode, initialPayload } = options;

    // --- State Management ---
    const [queue, setQueue] = useState<BriefingPayload[]>(initialPayload || []);
    const [isInitialLoading, setIsInitialLoading] = useState(queue.length === 0);
    const [index, setIndex] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Track loaded VocabIDs to exclude them in next fetch
    const loadedVocabIds = useRef<Set<number>>(new Set());

    // 防止 useEffect 多次执行
    const initialMountRef = useRef(false);

    // Response Timer for implicit grading
    const startTime = useRef<number>(Date.now());

    // --- Derived State ---
    const currentDrill = queue[index] || null;
    const progress = queue.length > 0 ? ((index + 1) / queue.length) * 100 : 0;

    // --- Helper: Initialize vocab ID set ---
    const initVocabSet = useCallback((items: BriefingPayload[]) => {
        for (const p of items) {
            const vid = p.meta?.vocabId;
            if (vid && typeof vid === 'number') {
                loadedVocabIds.current.add(vid);
            }
        }
    }, []);

    // --- Action: Load More (Infinite Scroll) ---
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

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
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error('[loadMore] Failed:', e);
            toast.error('网络不稳定，请稍后再试', { duration: 3000 });
            setHasMore(false);
        } finally {
            setIsLoadingMore(false);
        }
    }, [userId, mode, initVocabSet, isLoadingMore, hasMore]);

    // --- Action: Load Initial Data ---
    const loadInitialData = useCallback(async () => {
        try {
            const res = await getNextDrillBatch({
                userId,
                mode,
                limit: BATCH_LIMIT,
                excludeVocabIds: []
            });

            if (res.status === 'success' && res.data && res.data.length > 0) {
                initVocabSet(res.data);
                setQueue(res.data);
            } else {
                toast.error('加载训练数据失败');
            }
        } catch (e) {
            toast.error('网络错误，请重试');
        } finally {
            setIsInitialLoading(false);
        }
    }, [userId, mode, initVocabSet]);

    // --- Effect: Mount - Restore or Load ---
    useEffect(() => {
        // 防止 StrictMode 或热重载导致多次执行
        if (initialMountRef.current) return;
        initialMountRef.current = true;

        if (initialPayload && initialPayload.length > 0) {
            initVocabSet(initialPayload);
            setIsInitialLoading(false);
            return;
        }

        const saved = loadSession(userId, mode);
        if (saved && saved.queue.length > 0 && saved.currentIndex < saved.queue.length) {
            setQueue(saved.queue);
            setIndex(saved.currentIndex);
            initVocabSet(saved.queue);
            setIsInitialLoading(false);
            toast.success('已恢复上次进度', { duration: 2000 });
        } else {
            loadInitialData();
        }
    }, [userId, mode, initialPayload, initVocabSet, loadInitialData]);

    // --- Effect: Persist to Storage ---
    useEffect(() => {
        if (queue.length > 0 && !completed) {
            saveSession(userId, mode, queue, index);
        }
    }, [queue, index, completed, userId, mode]);

    // --- Effect: Reset status on index change ---
    useEffect(() => {
        setStatus('idle');
        setSelectedOption(null);
        startTime.current = Date.now();
    }, [index]);

    // --- Effect: Lazy Load Trigger ---
    useEffect(() => {
        if (isInitialLoading) return;

        const remaining = queue.length - index;
        if (remaining <= LOAD_THRESHOLD && !isLoadingMore && hasMore) {
            loadMore();
        }
    }, [index, queue.length, isLoadingMore, isInitialLoading, hasMore, loadMore]);

    // --- Action: Handle Option Select ---
    const handleOptionSelect = useCallback((option: string) => {
        if (status !== 'idle') return;

        const interactSegment = currentDrill?.segments.find(s => s.type === 'interaction');
        const answerKey = interactSegment?.task?.answer_key;
        if (!answerKey) return;

        setSelectedOption(option);

        const normalize = (s: string) => s.trim().toLowerCase();
        const isCorrect = normalize(option) === normalize(answerKey);

        setStatus(isCorrect ? 'correct' : 'wrong');
    }, [status, currentDrill]);

    // --- Action: Handle Complete ---
    const handleComplete = useCallback(async (result: boolean | number) => {
        if (!currentDrill) return;

        const vocabId = (currentDrill.meta as any)?.vocabId || 0;

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
        const isRetry = (currentDrill.meta as any)?.isRetry;

        // 静默记录，但打印错误日志 (FSRS Integrity)
        recordOutcome({
            userId,
            vocabId,
            grade: grade as any,
            mode,
            duration,
            isRetry
        }).catch((e) => {
            console.error('[FSRS] recordOutcome failed:', e);
        });

        // Retry Queue: Insert wrong answers back
        if (!isCorrect) {
            const retryDrill = JSON.parse(JSON.stringify(currentDrill)) as BriefingPayload;
            if (!retryDrill.meta) retryDrill.meta = {} as any;
            (retryDrill.meta as any).isRetry = true;

            const insertIndex = Math.min(queue.length, index + 5);
            setQueue(prev => {
                const next = [...prev];
                next.splice(insertIndex, 0, retryDrill);
                return next;
            });
        }

        // Move to next
        if (index < queue.length - 1) {
            setStatus('idle');
            setSelectedOption(null);
            setIndex(i => i + 1);
        } else {
            clearSession(userId, mode);
            setCompleted(true);
        }
    }, [currentDrill, userId, mode, queue.length, index]);

    // --- Action: Handle Next (for modes like CHUNKING) ---
    const handleNext = useCallback(() => {
        if (index < queue.length - 1) {
            setStatus('idle');
            setSelectedOption(null);
            setIndex(i => i + 1);
        } else {
            clearSession(userId, mode);
            setCompleted(true);
        }
    }, [index, queue.length, userId, mode]);

    // --- Action: Reset ---
    const reset = useCallback(() => {
        setQueue([]);
        setIndex(0);
        setCompleted(false);
        setStatus('idle');
        setSelectedOption(null);
        setHasMore(true);
        loadedVocabIds.current.clear();
        clearSession(userId, mode);
    }, [userId, mode]);

    return {
        queue,
        index,
        status,
        completed,
        isInitialLoading,
        isLoadingMore,
        hasMore,
        selectedOption,
        currentDrill,
        progress,
        handleOptionSelect,
        handleComplete,
        handleNext,
        setStatus,
        reset,
    };
}
