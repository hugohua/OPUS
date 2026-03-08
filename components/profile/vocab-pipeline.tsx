"use client";

import { ProfileStats } from "@/actions/get-profile-stats";

const STAGES = [
    { key: "newCount" as const, label: "新词", color: "bg-red-400", textColor: "text-red-500", dotColor: "bg-red-400" },
    { key: "learningCount" as const, label: "学习中", color: "bg-amber-400", textColor: "text-amber-500", dotColor: "bg-amber-400" },
    { key: "reviewCount" as const, label: "复习中", color: "bg-blue-400", textColor: "text-blue-500", dotColor: "bg-blue-400" },
    { key: "masteredCount" as const, label: "已掌握", color: "bg-emerald-500", textColor: "text-emerald-500", dotColor: "bg-emerald-500" },
];

/**
 * 词汇进度总览 (Vocab Pipeline)
 * 展示词汇在 NEW → LEARNING → REVIEW → MASTERED 各阶段的分布
 */
export function VocabPipeline({ data }: { data: ProfileStats["memoryHealth"] }) {
    const total = data.newCount + data.learningCount + data.reviewCount + data.masteredCount;

    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-zinc-500">词汇进度总览</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    共 {total} 词
                </span>
            </div>

            {total === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">暂无词汇数据</p>
            ) : (
                <>
                    {/* 堆叠条 */}
                    <div className="h-3 w-full rounded-full overflow-hidden flex mb-4">
                        {STAGES.map(({ key, color }) => {
                            const pct = (data[key] / total) * 100;
                            if (pct === 0) return null;
                            return (
                                <div
                                    key={key}
                                    className={`${color} transition-all duration-700`}
                                    style={{ width: `${pct}%` }}
                                />
                            );
                        })}
                    </div>

                    {/* 四阶段卡片 */}
                    <div className="grid grid-cols-4 gap-2">
                        {STAGES.map(({ key, label, textColor, dotColor }) => {
                            const count = data[key];
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                                <div key={key} className="text-center">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                        <span className="text-[10px] text-zinc-500">{label}</span>
                                    </div>
                                    <span className={`text-lg font-bold font-mono ${textColor}`}>
                                        {count}
                                    </span>
                                    <span className="text-[9px] text-zinc-400 ml-0.5">{pct}%</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
