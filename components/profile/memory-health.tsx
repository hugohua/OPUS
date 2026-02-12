"use client";

import { ProfileStats } from "@/actions/get-profile-stats";

/**
 * 记忆健康环形图
 * 展示 FSRS 状态分布 (New/Learning/Review/Mastered)
 */
export function MemoryHealth({ data }: { data: ProfileStats["memoryHealth"] }) {
    const { newCount, learningCount, reviewCount, masteredCount, retentionRate } = data;
    const total = newCount + learningCount + reviewCount + masteredCount;

    // 计算百分比 (避免除零)
    const pct = total > 0
        ? {
            new: (newCount / total) * 100,
            learning: ((learningCount + reviewCount) / total) * 100,
            mastered: (masteredCount / total) * 100,
        }
        : { new: 0, learning: 0, mastered: 100 };

    // conic-gradient 分段
    const gradient = total > 0
        ? `conic-gradient(#ef4444 0% ${pct.new}%, #eab308 ${pct.new}% ${pct.new + pct.learning}%, #10b981 ${pct.new + pct.learning}% 100%)`
        : `conic-gradient(#a1a1aa 0% 100%)`;

    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-500">记忆健康</span>
            <div className="relative w-24 h-24 mx-auto my-2">
                <div
                    className="w-full h-full rounded-full"
                    style={{ background: gradient }}
                />
                <div className="absolute inset-2 bg-white dark:bg-zinc-900 rounded-full flex flex-col items-center justify-center">
                    <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
                        {retentionRate}%
                    </span>
                    <span className="text-[8px] text-zinc-400 uppercase">掌握率</span>
                </div>
            </div>
            <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />新词
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />学习中
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />已掌握
                </div>
            </div>
        </div>
    );
}
