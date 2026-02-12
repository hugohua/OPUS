/**
 * SessionSkeleton - 会话加载骨架屏组件
 * 功能：
 *   在 Drill 数据加载时显示优雅的骨架屏动画
 *   已更新匹配 FocusShell 视觉结构
 */
'use client';

import { cn } from "@/lib/utils";
import { FocusShell } from "@/components/drill/focus-shell";
import { ControlDeck } from "@/components/drill/control-deck";

interface SessionSkeletonProps {
    mode?: string;
}

export function SessionSkeleton({ mode = "SYNTAX" }: SessionSkeletonProps) {
    return (
        <FocusShell
            variant="default"
            progress={0}
            label={`LOADING • ${mode}`}
            className="animate-pulse" // Global pulse for subtle effect
            footer={
                // Skeleton Control Deck
                <div className="grid grid-cols-2 gap-3 w-full animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                    ))}
                </div>
            }
        >
            {/* Main Content Skeleton */}
            <div className="w-full max-w-md flex flex-col items-center justify-center space-y-8 animate-pulse">

                {/* Text Block Skeleton */}
                <div className="w-full space-y-4">
                    <div className="h-8 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto" />
                    <div className="h-8 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto" />
                </div>

                {/* Secondary Meta Skeleton */}
                <div className="w-full flex justify-center gap-4 mt-8">
                    <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>

                {/* Loading Indicator Overlay */}
                <div className="mt-12 flex flex-col items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Preparing {mode}
                    </span>
                </div>

            </div>
        </FocusShell>
    );
}
