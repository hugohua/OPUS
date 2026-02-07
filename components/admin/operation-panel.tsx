/**
 * 操作面板组件
 * 对应参考设计：Manual Triggers
 */
'use client';

import { useState } from 'react';
import { Play, Pause, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    handlePauseQueue,
    handleResumeQueue,
    handleClearQueue,
    handleTriggerGeneration,
} from '@/actions/queue-admin';
import { SessionMode } from '@/types/briefing';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface OperationPanelProps {
    isPaused: boolean;
    userId: string;
}

export function OperationPanel({ isPaused: initialPaused, userId }: OperationPanelProps) {
    const [isPaused, setIsPaused] = useState(initialPaused);
    const [loading, setLoading] = useState<string | null>(null);

    const handleTogglePause = async () => {
        setLoading('pause');
        try {
            if (isPaused) {
                const result = await handleResumeQueue();
                if (result.status === 'success') {
                    setIsPaused(false);
                    toast.success('队列已恢复');
                } else {
                    toast.error(result.message);
                }
            } else {
                const result = await handlePauseQueue();
                if (result.status === 'success') {
                    setIsPaused(true);
                    toast.success('队列已暂停');
                } else {
                    toast.error(result.message);
                }
            }
        } finally {
            setLoading(null);
        }
    };

    const handleClear = async () => {
        // Confirmation is now handled by AlertDialog
        setLoading('clear');
        try {
            const result = await handleClearQueue();
            if (result.status === 'success') {
                toast.success('队列已清空');
            } else {
                toast.error(result.message);
            }
        } finally {
            setLoading(null);
        }
    };

    const handleTrigger = async (mode: SessionMode) => {
        setLoading(`trigger-${mode}`);
        try {
            // 使用传入的真实用户 ID
            const result = await handleTriggerGeneration(userId, mode);
            if (result.status === 'success') {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="rounded-3xl border border-border bg-card/50 backdrop-blur-xl p-4 shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">手动触发 (Manual Triggers)</h3>

            {/* L0: 基础训练 (Syntax + Phrase) */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-500">L0</span>
                    <span className="text-xs font-medium text-muted-foreground">基础训练 (Foundation)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <TriggerButton
                        mode="SYNTAX"
                        label="语法 (Syntax)"
                        color="emerald"
                        onClick={() => handleTrigger('SYNTAX')}
                        loading={loading === 'trigger-SYNTAX'}
                    />
                    <TriggerButton
                        mode="PHRASE"
                        label="短语 (Phrase)"
                        color="emerald"
                        onClick={() => handleTrigger('PHRASE')}
                        loading={loading === 'trigger-PHRASE'}
                    />
                </div>
            </div>

            {/* L1: 韵律训练 (Chunking + Audio) */}
            <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/5 text-sky-500">L1</span>
                    <span className="text-xs font-medium text-muted-foreground">韵律训练 (Rhythm)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <TriggerButton
                        mode="CHUNKING"
                        label="语块 (Chunking)"
                        color="sky"
                        onClick={() => handleTrigger('CHUNKING')}
                        loading={loading === 'trigger-CHUNKING'}
                    />
                    <TriggerButton
                        mode="AUDIO"
                        label="听力 (Audio)"
                        color="sky"
                        onClick={() => handleTrigger('AUDIO')}
                        loading={loading === 'trigger-AUDIO'}
                    />
                </div>
            </div>

            {/* L2: 认知训练 (Nuance + Reading) */}
            <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/5 text-violet-500">L2</span>
                    <span className="text-xs font-medium text-muted-foreground">认知训练 (Cognitive)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <TriggerButton
                        mode="NUANCE"
                        label="辨析 (Nuance)"
                        color="violet"
                        onClick={() => handleTrigger('NUANCE')}
                        loading={loading === 'trigger-NUANCE'}
                    />
                    <TriggerButton
                        mode="READING"
                        label="阅读 (Reading)"
                        color="violet"
                        onClick={() => handleTrigger('READING')}
                        loading={loading === 'trigger-READING'}
                    />
                </div>
            </div>

            <div className="pt-4 mt-2 border-t border-border flex gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            disabled={loading !== null}
                            className="flex-1 py-2 text-xs font-medium text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                        >
                            {loading === 'clear' ? '清空中...' : '清空队列'}
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-[400px] bg-card border-border">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">确认清空队列？</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                                此操作将清除所有等待中和失败的任务。如果您的队列因旧任务积压而堵塞，这很有用。正在处理中的任务不会被中断。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-border text-foreground hover:bg-muted hover:text-foreground">取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                确认清空
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <button
                    onClick={handleTogglePause}
                    disabled={loading !== null}
                    className="flex-1 py-2 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                    {loading === 'pause' ? '...' : isPaused ? '恢复' : '暂停'}
                </button>
            </div>
        </div>
    );
}

function TriggerButton({
    mode,
    label,
    color,
    onClick,
    loading
}: {
    mode: string,
    label?: string,
    color: 'emerald' | 'sky' | 'violet' | 'amber',
    onClick: () => void,
    loading: boolean
}) {
    // Semantic color mapping
    const styleMap = {
        emerald: "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        sky: "border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 text-sky-600 dark:text-sky-400",
        violet: "border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 text-violet-600 dark:text-violet-400",
        amber: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };

    const activeStyle = styleMap[color] || styleMap.amber;

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={cn(
                "group flex items-center justify-between p-2.5 rounded-lg border transition-all active:scale-[0.98]",
                activeStyle,
                "disabled:opacity-50 disabled:pointer-events-none"
            )}
        >
            <span className="text-xs font-medium">
                {loading ? '...' : (label || mode)}
            </span>
            {!loading && <Play className="w-3 h-3 opacity-70 group-hover:opacity-100 fill-current" />}
        </button>
    )
}
