"use client";

import { ProfileStats } from "@/actions/get-profile-stats";

/**
 * 五维认知雷达图 (V/A/M/C/X)
 * 纯 SVG 实现，无第三方图表库
 */
export function SkillRadar({ data }: { data: ProfileStats["skillRadar"] }) {
    const labels = [
        { key: "V", label: "视觉", angle: -90 },
        { key: "M", label: "语义", angle: -18 },
        { key: "C", label: "语境", angle: 54 },
        { key: "X", label: "逻辑", angle: 126 },
        { key: "A", label: "听觉", angle: 198 },
    ] as const;

    const cx = 50, cy = 50, maxR = 40;

    // 角度转弧度
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // 计算某个维度在雷达图上的坐标
    const getPoint = (angle: number, value: number) => {
        const r = (value / 100) * maxR;
        return {
            x: cx + r * Math.cos(toRad(angle)),
            y: cy + r * Math.sin(toRad(angle)),
        };
    };

    // 生成数据多边形的 points
    const dataPoints = labels
        .map(l => {
            const val = data[l.key as keyof typeof data] || 0;
            const pt = getPoint(l.angle, val);
            return `${pt.x},${pt.y}`;
        })
        .join(" ");

    // 生成网格环
    const gridLevels = [25, 50, 75, 100];

    // 判断整体状态
    const avg = Math.round(Object.values(data).reduce((s, v) => s + v, 0) / 5);
    const statusLabel = avg >= 60 ? "均衡" : avg >= 30 ? "发展中" : "起步";
    const statusColor = avg >= 60
        ? "bg-emerald-500/10 text-emerald-500"
        : avg >= 30
            ? "bg-amber-500/10 text-amber-500"
            : "bg-zinc-500/10 text-zinc-500";

    return (
        <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-zinc-500">认知雷达</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${statusColor}`}>
                    {statusLabel}
                </span>
            </div>
            <div className="relative h-40 w-full flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-32 h-32 absolute">
                    {/* 网格环 */}
                    {gridLevels.map(level => (
                        <polygon
                            key={level}
                            points={labels.map(l => {
                                const pt = getPoint(l.angle, level);
                                return `${pt.x},${pt.y}`;
                            }).join(" ")}
                            className="fill-none stroke-zinc-200 dark:stroke-zinc-800"
                            strokeWidth={0.5}
                        />
                    ))}
                    {/* 轴线 */}
                    {labels.map(l => {
                        const pt = getPoint(l.angle, 100);
                        return (
                            <line
                                key={l.key}
                                x1={cx} y1={cy} x2={pt.x} y2={pt.y}
                                className="stroke-zinc-200 dark:stroke-zinc-800"
                                strokeWidth={0.5}
                            />
                        );
                    })}
                </svg>

                {/* 数据层 */}
                <svg viewBox="0 0 100 100" className="w-32 h-32 absolute drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    <polygon
                        points={dataPoints}
                        className="fill-emerald-500/20 stroke-emerald-500 stroke-2"
                    />
                </svg>

                {/* 标签 */}
                {labels.map(l => {
                    const pt = getPoint(l.angle, 120);
                    const val = data[l.key as keyof typeof data] || 0;
                    const isWeak = val < 30;
                    return (
                        <span
                            key={l.key}
                            className={`absolute text-[9px] font-mono ${isWeak ? 'text-rose-400 font-bold' : 'text-zinc-400'}`}
                            style={{
                                left: `${(pt.x / 100) * 100}%`,
                                top: `${(pt.y / 100) * 100}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {l.label}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
