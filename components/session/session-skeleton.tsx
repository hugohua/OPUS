/**
 * SessionSkeleton - 会话加载骨架屏组件
 * 功能：
 *   在 Drill 数据加载时显示优雅的骨架屏动画
 *   匹配 EditorialDrill 组件的视觉结构
 */
'use client';

import { cn } from "@/lib/utils";

interface SessionSkeletonProps {
    mode?: string;
}

export function SessionSkeleton({ mode = "SYNTAX" }: SessionSkeletonProps) {
    return (
        <div className="dark:bg-zinc-950 bg-zinc-50 relative h-screen w-full overflow-hidden font-sans antialiased flex flex-col transition-colors duration-300">

            {/* Background Glow Removed */}

            {/* Header 骨架 */}
            <header className="relative z-10 flex items-center justify-between px-4 h-14 shrink-0">
                {/* 返回按钮骨架 */}
                <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />

                {/* 进度条骨架 */}
                <div className="flex-1 mx-8 flex flex-col items-center">
                    <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full w-1/4 bg-violet-500/30 rounded-full animate-pulse" />
                    </div>
                    <div className="mt-2 h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>

                {/* 右侧按钮骨架 */}
                <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            </header>

            {/* 主内容区骨架 */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-start pt-12 md:pt-24 px-4 min-h-0 overflow-y-auto pb-4">

                {/* EditorialDrill 卡片骨架 */}
                <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/15 bg-white/80 dark:bg-zinc-900/60 shadow-xl backdrop-blur-xl overflow-hidden flex flex-col min-h-[300px]">

                    {/* 文本区域骨架 */}
                    <div className="p-8 flex flex-col items-start justify-center text-left flex-1 space-y-4">

                        {/* 句子骨架 - 模拟 S-V-O 结构 */}
                        <div className="w-full space-y-3">
                            {/* Subject 主语骨架 */}
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-32 bg-emerald-100 dark:bg-emerald-900/30 rounded animate-pulse" />
                                <div className="h-6 w-6 bg-emerald-200 dark:bg-emerald-800/50 rounded animate-pulse" />
                            </div>

                            {/* Verb 动词空位骨架 */}
                            <div className="flex items-center gap-2 ml-2">
                                <div className="h-8 w-20 border-b-2 border-dashed border-zinc-400 dark:border-zinc-600 animate-pulse" />
                                <div className="h-4 w-4 bg-zinc-300 dark:bg-zinc-700 rounded-full animate-pulse" />
                            </div>

                            {/* Object 宾语骨架 */}
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-48 bg-sky-100 dark:bg-sky-900/30 rounded animate-pulse" />
                                <div className="h-6 w-6 bg-sky-200 dark:bg-sky-800/50 rounded animate-pulse" />
                            </div>
                        </div>

                        {/* Context 底部骨架 */}
                        <div className="mt-12 w-full border-t border-zinc-200 dark:border-white/5 pt-4">
                            <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* 提示文字骨架 */}
                <div className="mt-6 h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </main>

            {/* Footer 按钮骨架 */}
            <footer className="relative z-20 w-full px-5 pb-[100px] pt-4 shrink-0 flex items-center gap-4 min-h-[140px] items-end">
                {/* 3 个选项按钮骨架 */}
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex-1 h-14 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse",
                            // 交错动画延迟
                            i === 1 && "animation-delay-0",
                            i === 2 && "animation-delay-150",
                            i === 3 && "animation-delay-300"
                        )}
                        style={{ animationDelay: `${(i - 1) * 150}ms` }}
                    />
                ))}
            </footer>

            {/* 加载指示器（覆盖层） */}
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="flex flex-col items-center gap-3 bg-white/80 dark:bg-zinc-900/80 px-6 py-4 rounded-2xl backdrop-blur-sm border border-zinc-200 dark:border-white/10 shadow-lg">
                    {/* 呼吸动画圆点 */}
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Preparing {mode} Drill
                    </span>
                </div>
            </div>
        </div>
    );
}
