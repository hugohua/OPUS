"use client";

import { ProfileStats } from "@/actions/get-profile-stats";

/**
 * 未来 5 天复习负载柱状图
 */
export function LoadForecast({ data }: { data: ProfileStats["loadForecast"] }) {
    // 服务端已返回处理好的 5 天序列，直接分配星期标签即可，避免前后端时区差异导致的匹配失效
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const days = data.map((item, i) => {
        const d = new Date(item.date);
        return {
            label: i === 0 ? "今天" : `周${weekdays[d.getDay()]}`,
            date: item.date,
            count: item.count,
        };
    });

    const maxCount = Math.max(...days.map(d => d.count), 1);

    // 颜色映射
    const getColor = (count: number) => {
        if (count === 0) return "bg-zinc-200/80 dark:bg-zinc-700";
        const ratio = count / maxCount;
        if (ratio > 0.7) return "bg-rose-400/80 hover:bg-rose-500";
        if (ratio > 0.4) return "bg-amber-400/80 hover:bg-amber-500";
        return "bg-emerald-400/80 hover:bg-emerald-500";
    };

    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-medium text-zinc-500">未来 5 天</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    复习量
                </span>
            </div>

            {days.every(d => d.count === 0) ? (
                <div className="flex-1 flex items-center justify-center h-28 text-center">
                    <p className="text-xs text-zinc-400">近期无复习任务<br /><span className="text-[10px]">安心休息 ☕</span></p>
                </div>
            ) : (
                <div className="flex items-end justify-between gap-2 pb-1" style={{ height: 112 }}>
                    {days.map((d, i) => {
                        // 柱区高度 80px，自适应算法
                        const BAR_AREA = 80;
                        const barH = d.count === 0
                            ? 6
                            : maxCount <= 5
                                ? Math.round(BAR_AREA * (0.3 + (d.count / maxCount) * 0.65))
                                : Math.round(BAR_AREA * (0.15 + (d.count / maxCount) * 0.8));
                        return (
                            <div key={i} className="w-full flex flex-col items-center justify-end gap-1">
                                {d.count > 0 && (
                                    <span className="text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                                        {d.count}
                                    </span>
                                )}
                                <div
                                    className={`w-full ${getColor(d.count)} rounded-t-sm transition-all`}
                                    style={{ height: barH }}
                                />
                                <span className="text-[9px] font-mono text-zinc-400">{d.label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
