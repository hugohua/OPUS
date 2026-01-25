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
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-sm flex flex-col justify-between h-full">
            <h3 className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest mb-4">手动触发 (Manual Triggers)</h3>

            <div className="space-y-3">
                <TriggerButton
                    mode="SYNTAX"
                    color="emerald"
                    onClick={() => handleTrigger('SYNTAX')}
                    loading={loading === 'trigger-SYNTAX'}
                />
                <TriggerButton
                    mode="CHUNKING"
                    color="sky"
                    onClick={() => handleTrigger('CHUNKING')}
                    loading={loading === 'trigger-CHUNKING'}
                />
                {/* 注意：参考设计只有三个按钮，这里我们保留所有支持的模式 */}
                <TriggerButton
                    mode="NUANCE"
                    color="violet"
                    onClick={() => handleTrigger('NUANCE')}
                    loading={loading === 'trigger-NUANCE'}
                />
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            disabled={loading !== null}
                            className="flex-1 py-2 text-xs font-medium text-rose-400 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                        >
                            {loading === 'clear' ? '清空中...' : '清空队列'}
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认清空队列？</AlertDialogTitle>
                            <AlertDialogDescription>
                                此操作将清除所有等待中和失败的任务。如果您的队列因旧任务积压而堵塞，这很有用。正在处理中的任务不会被中断。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClear} className="bg-rose-600 hover:bg-rose-700">
                                确认清空
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <button
                    onClick={handleTogglePause}
                    disabled={loading !== null}
                    className="flex-1 py-2 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                    {loading === 'pause' ? '...' : isPaused ? '恢复' : '暂停'}
                </button>
            </div>
        </div>
    );
}

function TriggerButton({
    mode,
    color,
    onClick,
    loading
}: {
    mode: string,
    color: 'emerald' | 'sky' | 'violet' | 'amber',
    onClick: () => void,
    loading: boolean
}) {
    const styles = {
        emerald: "hover:bg-emerald-900/20 hover:border-emerald-500/30 group-hover:text-emerald-400 group-hover:text-emerald-500",
        sky: "hover:bg-sky-900/20 hover:border-sky-500/30 group-hover:text-sky-400 group-hover:text-sky-500",
        violet: "hover:bg-violet-900/20 hover:border-violet-500/30 group-hover:text-violet-400 group-hover:text-violet-500",
        amber: "hover:bg-amber-900/20 hover:border-amber-500/30 group-hover:text-amber-400 group-hover:text-amber-500",
    };

    // Note: The specific styles from prop need to be applied conditionally
    // Since we can't dynamic interpolate full classes in Tailwind safely without whitelist, 
    // we map known colors.

    let btnClass = "bg-zinc-800 border border-transparent transition-all active:scale-[0.98]";
    let textClass = "text-zinc-300";
    let iconClass = "text-zinc-600";

    if (color === 'emerald') {
        btnClass += " hover:bg-emerald-900/20 hover:border-emerald-500/30";
        textClass += " group-hover:text-emerald-400";
        iconClass += " group-hover:text-emerald-500";
    } else if (color === 'sky') {
        btnClass += " hover:bg-sky-900/20 hover:border-sky-500/30";
        textClass += " group-hover:text-sky-400";
        iconClass += " group-hover:text-sky-500";
    } else if (color === 'violet') {
        btnClass += " hover:bg-violet-900/20 hover:border-violet-500/30";
        textClass += " group-hover:text-violet-400";
        iconClass += " group-hover:text-violet-500";
    } else {
        btnClass += " hover:bg-amber-900/20 hover:border-amber-500/30";
        textClass += " group-hover:text-amber-400";
        iconClass += " group-hover:text-amber-500";
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={cn("group w-full flex items-center justify-between p-3 rounded-xl disabled:opacity-50", btnClass)}
        >
            <span className={cn("text-sm font-medium", textClass)}>
                {loading ? '生成中...' : `生成 ${mode.charAt(0) + mode.slice(1).toLowerCase()}`}
            </span>
            <ArrowRight className={cn("w-4 h-4", iconClass)} />
        </button>
    )
}
