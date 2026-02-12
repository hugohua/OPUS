"use client";

/**
 * 活跃热力图 (过去 90 天)
 * 展示用户每天是否进行了练习
 */
export function ConsistencyLog({ activeDays }: { activeDays: string[] }) {
    // 生成过去 90 天的日期网格
    const today = new Date();
    const grid: Array<{ date: string; active: boolean }> = [];

    const activeSet = new Set(activeDays);

    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        grid.push({ date: dateStr, active: activeSet.has(dateStr) });
    }

    const totalActive = activeDays.length;

    return (
        <div className="col-span-1 md:col-span-3 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden">
            <div className="flex justify-between items-end mb-3">
                <span className="text-xs font-medium text-zinc-500">活跃记录</span>
                <span className="text-[10px] font-mono text-zinc-400">
                    近 90 天 · {totalActive} 天活跃
                </span>
            </div>
            <div className="flex flex-wrap gap-1 opacity-80">
                {grid.map((cell, i) => (
                    <div
                        key={i}
                        title={cell.date}
                        className={`w-3 h-3 rounded-sm transition-colors ${cell.active
                                ? 'bg-emerald-500'
                                : 'bg-zinc-100 dark:bg-zinc-800'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
