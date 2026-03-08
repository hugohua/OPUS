"use client";

import { UserLevel } from "@/actions/get-profile-stats";

/**
 * 等级徽章 (纯展示组件)
 * PRD §4: L0 Trainee / L1 Intern / L2 Executive
 */
export function LevelBadge({ level }: { level: UserLevel }) {
    const config = {
        0: {
            gradient: "from-zinc-400 to-zinc-600",
            bg: "bg-zinc-500/10",
            text: "text-zinc-500 dark:text-zinc-400",
            bar: "bg-zinc-400",
            glow: "shadow-zinc-500/20",
        },
        1: {
            gradient: "from-blue-400 to-indigo-600",
            bg: "bg-indigo-500/10",
            text: "text-indigo-600 dark:text-indigo-400",
            bar: "bg-gradient-to-r from-blue-400 to-indigo-500",
            glow: "shadow-indigo-500/20",
        },
        2: {
            gradient: "from-amber-400 to-orange-600",
            bg: "bg-amber-500/10",
            text: "text-amber-600 dark:text-amber-400",
            bar: "bg-gradient-to-r from-amber-400 to-orange-500",
            glow: "shadow-amber-500/20",
        },
    } as const;

    const c = config[level.code];

    return (
        <div className={`mt-4 p-3 rounded-xl ${c.bg} border border-white/10`}>
            {/* 等级标题行 */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${c.gradient} text-white`}>
                        LV.{level.code}
                    </span>
                    <span className={`text-sm font-bold ${c.text}`}>
                        {level.label}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                        {level.labelCn}
                    </span>
                </div>
                {level.code < 2 && (
                    <span className="text-[10px] font-mono text-zinc-400">
                        {level.progress}%
                    </span>
                )}
            </div>

            {/* 进度条 (L2 时不显示) */}
            {level.code < 2 && (
                <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                    <div
                        className={`h-full ${c.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${level.progress}%` }}
                    />
                </div>
            )}

            {/* 下一级提示 */}
            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-tight">
                {level.nextHint}
            </p>
        </div>
    );
}
