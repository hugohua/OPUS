"use client";

import { type ArenaStats } from "@/actions/get-profile-stats";
import { Swords, Target, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Arena 战绩摘要
 * 展示 Part5/Part6 答题总量、正确率、平均响应速度
 */
export function ArenaSummary({ data }: { data: ArenaStats }) {
    if (data.totalAttempts === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <span className="text-xs font-medium text-zinc-500 mb-3 block">Arena 战绩</span>
                <p className="text-xs text-zinc-400 text-center py-4">尚未参加 Arena 实战</p>
            </div>
        );
    }

    const avgSec = (data.avgResponseMs / 1000).toFixed(1);

    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-zinc-500">Arena 战绩</span>
                <Link
                    href="/dashboard/arena"
                    className="flex items-center gap-0.5 text-[10px] text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                    去实战 <ChevronRight className="w-3 h-3" />
                </Link>
            </div>

            {/* 总览三指标 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Swords className="w-3 h-3 text-indigo-400" />
                        <span className="text-[10px] text-zinc-500">总题数</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                        {data.totalAttempts}
                    </span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Target className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-zinc-500">正确率</span>
                    </div>
                    <span className={`text-lg font-bold font-mono ${data.accuracyRate >= 70 ? 'text-emerald-500' : data.accuracyRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {data.accuracyRate}%
                    </span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-zinc-500">均速</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-zinc-900 dark:text-white">
                        {avgSec}<span className="text-[10px] text-zinc-400">s</span>
                    </span>
                </div>
            </div>

            {/* Part 5 / Part 6 对比 */}
            <div className="grid grid-cols-2 gap-2">
                {([
                    { label: "Part 5", stats: data.part5, color: "bg-indigo-500" },
                    { label: "Part 6", stats: data.part6, color: "bg-violet-500" },
                ] as const).map(({ label, stats, color }) => (
                    <div key={label} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2.5">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{label}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{stats.total} 题</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1">
                            <div
                                className={`h-full ${color} rounded-full transition-all duration-700`}
                                style={{ width: `${stats.rate}%` }}
                            />
                        </div>
                        <span className={`text-xs font-bold font-mono ${stats.rate >= 70 ? 'text-emerald-500' : stats.rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                            {stats.rate}%
                        </span>
                        <span className="text-[9px] text-zinc-400 ml-1">({stats.correct}/{stats.total})</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
