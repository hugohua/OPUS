"use client";

import { type TrackStats } from "@/actions/get-profile-stats";
import { Eye, Headphones, Brain } from "lucide-react";

const TRACKS: Array<{
    key: 'VISUAL' | 'AUDIO' | 'CONTEXT';
    label: string;
    icon: typeof Eye;
    color: string;        // bar mastered
    bgColor: string;      // icon bg
    textColor: string;    // icon text
}> = [
        {
            key: 'VISUAL', label: '视觉轨',
            icon: Eye,
            color: 'bg-emerald-500',
            bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
            textColor: 'text-emerald-500 dark:text-emerald-400',
        },
        {
            key: 'AUDIO', label: '听觉轨',
            icon: Headphones,
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50 dark:bg-blue-500/10',
            textColor: 'text-blue-500 dark:text-blue-400',
        },
        {
            key: 'CONTEXT', label: '语境轨',
            icon: Brain,
            color: 'bg-violet-500',
            bgColor: 'bg-violet-50 dark:bg-violet-500/10',
            textColor: 'text-violet-500 dark:text-violet-400',
        },
    ];

/**
 * 多轨记忆概览
 * 展示 VISUAL / AUDIO / CONTEXT 三条 FSRS 曲线的掌握情况
 */
export function MultiTrackOverview({
    data,
}: {
    data: Record<'VISUAL' | 'AUDIO' | 'CONTEXT', TrackStats>;
}) {
    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <span className="text-xs font-medium text-zinc-500 mb-3 block">多轨记忆</span>

            <div className="space-y-3">
                {TRACKS.map(({ key, label, icon: Icon, color, bgColor, textColor }) => {
                    const stats = data[key];
                    const pct = stats.total > 0
                        ? Math.round((stats.mastered / stats.total) * 100)
                        : 0;
                    const learningPct = stats.total > 0
                        ? Math.round((stats.learning / stats.total) * 100)
                        : 0;

                    return (
                        <div key={key} className="flex items-center gap-3">
                            {/* 图标 */}
                            <div className={`p-1.5 rounded-lg ${bgColor} ${textColor} shrink-0`}>
                                <Icon className="w-4 h-4" />
                            </div>

                            {/* 标签 */}
                            <span className="text-xs font-medium w-14 shrink-0">{label}</span>

                            {/* 堆叠进度条 */}
                            <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                {stats.total > 0 ? (
                                    <div className="h-full flex">
                                        <div
                                            className={`${color} transition-all duration-700`}
                                            style={{ width: `${pct}%` }}
                                        />
                                        <div
                                            className="bg-amber-400 transition-all duration-700"
                                            style={{ width: `${learningPct}%` }}
                                        />
                                    </div>
                                ) : null}
                            </div>

                            {/* 数字 */}
                            <div className="text-right shrink-0 w-20">
                                {stats.total > 0 ? (
                                    <span className="text-[10px] font-mono text-zinc-500">
                                        <span className="font-bold text-zinc-900 dark:text-white">{stats.mastered}</span>
                                        /{stats.total}
                                        <span className="ml-1 text-zinc-400">{pct}%</span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-zinc-400">暂无数据</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 图例 */}
            <div className="flex gap-4 mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />已掌握
                </div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />学习中
                </div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />未学习
                </div>
            </div>
        </div>
    );
}
