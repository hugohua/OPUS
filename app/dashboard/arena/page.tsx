"use client";

import Link from "next/link";
import { Zap, BookOpen } from "lucide-react";

export default function ArenaDashboard() {
    return (
        <div className="min-h-[100dvh] bg-background flex flex-col relative selection:bg-brand-core/20">

            {/* Header */}
            <header className="pt-12 pb-4 px-6 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-primary">实战演练</h1>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Opus Engine Ready</span>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center border border-border">
                    <span className="font-mono text-xs font-bold text-primary">O</span>
                </div>
            </header>

            {/* Main Container */}
            <main className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">

                {/* Daily Status Card */}
                <div className="bg-zinc-900 rounded-2xl p-6 shadow-lg relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-violet-500/20 rounded-full blur-2xl group-hover:bg-violet-500/30 transition-all"></div>
                    <h2 className="text-violet-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">Daily Status</h2>
                    <div className="text-2xl font-bold text-white mb-4">今日待检验：<br /><span className="text-violet-400 text-3xl">12</span> 个核心词汇</div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2">
                        <div className="bg-violet-500 h-1.5 rounded-full w-[45%]"></div>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">FSRS SYNC: 45% COMPLETED</div>
                </div>

                {/* Select Mode Category */}
                <div className="space-y-4">
                    <h3 className="text-xs font-mono font-bold text-secondary uppercase tracking-widest px-1">Select Mode</h3>

                    <Link href="/dashboard/arena/blitz" className="block w-full text-left bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-violet-500 hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden dark:bg-zinc-900/60 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center border border-violet-100 dark:border-violet-500/20 shrink-0 group-hover:bg-violet-500 group-hover:text-white transition-colors text-violet-600 dark:text-violet-400">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-primary mb-1">单句闪电战 (Part 5)</h4>
                                <p className="text-xs text-secondary leading-relaxed">3-5分钟碎片时间<br />词汇与语法快测</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/dashboard/arena/mission" className="block w-full text-left bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-violet-500 hover:shadow-md transition-all active:scale-[0.98] group relative overflow-hidden dark:bg-zinc-900/60 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-border shrink-0 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-700 transition-colors text-secondary">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-primary mb-1">阅读狙击战 (Part 6/7)</h4>
                                <p className="text-xs text-secondary leading-relaxed">10-15分钟沉浸时间<br />商务长文实战</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </main>
        </div>
    );
}
