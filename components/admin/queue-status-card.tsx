/**
 * 队列状态卡片组件
 * 对应参考设计：Real-time Metrics
 */
'use client';

import { Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueStatusCardProps {
    status: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        isPaused: boolean;
    };
}

export function QueueStatusCard({ status }: QueueStatusCardProps) {
    const { waiting, active, completed, failed } = status;

    return (
        <div className="md:col-span-3 rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden group">
            {/* Background Icon Decoration */}
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none">
                <svg className="w-24 h-24 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>

            <h3 className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest mb-6">实时指标 (Real-Time)</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Pending */}
                <div className="flex flex-col">
                    <span className="text-zinc-400 text-xs mb-1">等待中 (Pending)</span>
                    <span className="text-4xl font-mono font-bold text-white max-md:text-3xl">
                        {waiting}
                    </span>
                </div>

                {/* Processing */}
                <div className="flex flex-col">
                    <span className="text-violet-400 text-xs mb-1 flex items-center gap-1">
                        处理中 (Processing)
                        {active > 0 && (
                            <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                        )}
                    </span>
                    <span className="text-4xl font-mono font-bold text-violet-400 max-md:text-3xl">
                        {active}
                    </span>
                </div>

                {/* Success */}
                <div className="flex flex-col">
                    <span className="text-emerald-400 text-xs mb-1">成功 (Success)</span>
                    <span className="text-4xl font-mono font-bold text-emerald-400 max-md:text-3xl">
                        {completed}
                    </span>
                </div>

                {/* Errors */}
                <div className="flex flex-col">
                    <span className="text-rose-400 text-xs mb-1">错误 (Errors)</span>
                    <span className="text-4xl font-mono font-bold text-zinc-700 dark:text-zinc-700 max-md:text-3xl">
                        {failed}
                    </span>
                </div>
            </div>
        </div>
    );
}
