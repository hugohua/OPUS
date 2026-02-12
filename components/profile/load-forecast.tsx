"use client";

import { ProfileStats } from "@/actions/get-profile-stats";

/**
 * 未来 5 天复习负载柱状图
 */
export function LoadForecast({ data }: { data: ProfileStats["loadForecast"] }) {
    // 填充未来 5 天 (即使某天没有数据也要显示)
    const days: Array<{ label: string; date: string; count: number }> = [];
    const today = new Date();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

    for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const match = data.find(item => item.date === dateStr);
        days.push({
            label: i === 0 ? "今天" : `周${weekdays[d.getDay()]}`,
            date: dateStr,
            count: match?.count || 0,
        });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);

    // 颜色映射
    const getColor = (count: number) => {
        if (count === 0) return "bg-zinc-200 dark:bg-zinc-700";
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

            <div className="flex-1 flex items-end justify-between gap-2 h-24 pb-1">
                {days.map((d, i) => {
                    const h = maxCount > 0 ? Math.max((d.count / maxCount) * 100, d.count > 0 ? 15 : 5) : 5;
                    return (
                        <div key={i} className="group relative w-full flex flex-col justify-end gap-1 cursor-pointer">
                            <div
                                className={`w-full ${getColor(d.count)} rounded-t-sm transition-all relative`}
                                style={{ height: `${h}%` }}
                            >
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-zinc-900 text-white px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {d.count} 词
                                </div>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-400 text-center">{d.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
