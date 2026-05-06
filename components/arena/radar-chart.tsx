"use client";

import { useEffect, useState } from "react";
import type { RadarDomain } from "@/lib/backend-core/arena/dashboard";

export interface RadarChartProps {
    domains: RadarDomain[];
    colorVariant?: "violet" | "cyan";
}

// 雷达图基础尺寸
const SIZE = 100;
const CENTER = SIZE / 2;
// 多边形顶点半径 (最大分数 100 对应的绘制半径，留出文字边距)
const MAX_RADIUS = 36;

/**
 * 技能树雷达图组件 (Radar Chart)
 * 接受服务端传入的长远分数 (0-100)，并在挂载后执行展开动画。
 */
export function RadarChart({ domains, colorVariant = "violet" }: RadarChartProps) {
    // 初始状态：全分为 0 (收缩在中心点)
    const [animatedScores, setAnimatedScores] = useState<number[]>(domains.map(() => 0));

    // 根据实际传入的边数动态切分 360 度圆盘 (防越界，至少为 3)
    const sides = Math.max(domains.length, 3);
    const angles = Array.from({ length: sides }).map((_, i) =>
        -Math.PI / 2 + (i * 2 * Math.PI) / sides
    );

    function getPointsString(scores: number[]): string {
        return scores.map((score, i) => {
            // 防御越界访问
            const angle = angles[i] !== undefined ? angles[i] : 0;
            const radius = (score / 100) * MAX_RADIUS;
            const x = CENTER + radius * Math.cos(angle);
            const y = CENTER + radius * Math.sin(angle);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(" ");
    }

    useEffect(() => {
        // 组件挂载一瞬间后，设定为真实分数触发动画 (过渡时间由 tailwind duration-700 管理)
        const frame = requestAnimationFrame(() => {
            setAnimatedScores(domains.map(d => Math.max(0, Math.min(100, d.score))));
        });
        return () => cancelAnimationFrame(frame);
    }, [domains]);

    // 背景参考线：满分边界和中等分边界
    const maxOutline = getPointsString(Array(sides).fill(100));
    const midOutline = getPointsString(Array(sides).fill(50));
    // 实际数据连线
    const dataPoints = getPointsString(animatedScores);

    // 计算实际顶点坐标，用于画圆点装饰
    const dotCoords = animatedScores.map((score, i) => {
        const radius = (score / 100) * MAX_RADIUS;
        const angle = angles[i] !== undefined ? angles[i] : 0;
        return {
            x: CENTER + radius * Math.cos(angle),
            y: CENTER + radius * Math.sin(angle),
        };
    });

    const polygonColorClass = colorVariant === "cyan"
        ? "text-cyan-500 fill-cyan-500/15 dark:fill-cyan-500/20"
        : "text-violet-500 fill-violet-500/15 dark:fill-violet-500/20";

    const dotFillColor = colorVariant === "cyan" ? "#06b6d4" : "#8b5cf6";

    return (
        <div className="relative w-full aspect-square max-w-[210px] mx-auto my-4">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* 1. 背景多边形轮廓 (Full & Mid) */}
                <polygon points={maxOutline} fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                <polygon points={midOutline} fill="none" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800/50" strokeWidth="1" />

                {/* 2. 轴线 (从中心向 N 个顶点辐射) */}
                {angles.map((angle, i) => {
                    const x = CENTER + MAX_RADIUS * Math.cos(angle);
                    const y = CENTER + MAX_RADIUS * Math.sin(angle);
                    return (
                        <line key={`axis-${i}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" strokeDasharray="2,2" />
                    );
                })}

                {/* 3. 数据层 (实心遮罩连线) */}
                <polygon
                    points={dataPoints}
                    fill="currentColor"
                    stroke="currentColor"
                    className={`${polygonColorClass} drop-shadow-sm transition-all duration-700 ease-out`}
                    strokeWidth="1.5"
                />

                {/* 4. 顶点圆球 */}
                {dotCoords.map((coord, i) => {
                    // 最薄弱项（例如分数低于 40 的项）给呼吸效果或变成红色
                    const isWeak = animatedScores[i] < 40;
                    return (
                        <circle
                            key={`dot-${i}`}
                            cx={coord.x}
                            cy={coord.y}
                            r={isWeak ? 2 : 1.5}
                            fill={isWeak ? "#f43f5e" : dotFillColor} // Rose-500 or selected primary
                            stroke="white"
                            strokeWidth="0.5"
                            className={`transition-all duration-700 ease-out ${isWeak ? 'animate-pulse drop-shadow-sm' : ''}`}
                        />
                    );
                })}
            </svg>

            {/* 外层绝对定位标签 (动态环绕) */}
            {domains.map((domain, i) => {
                const angle = angles[i] !== undefined ? angles[i] : 0;
                // 将标签沿半径向外延伸一定比例 (比如 radius + 15 变成 51%，这里我们直接使用 55%)
                // 由于 viewBox 是 100x100，中心点在 (50, 50)，标签通过 top/left 和 translate 完全按圆周排布
                const labelRadius = 55; // 这意味着它将在距离圆心 55% 的圆周上
                const top = 50 + labelRadius * Math.sin(angle);
                const left = 50 + labelRadius * Math.cos(angle);

                return (
                    <div
                        key={`label-${i}`}
                        className="absolute z-10 w-max"
                        style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <HoverBadge score={domain.score} label={domain.label} colorVariant={colorVariant} />
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Hover/Score Label 子组件
// ---------------------------------------------------------------------------

function HoverBadge({ score, label, colorVariant }: { score: number; label: string; colorVariant: "violet" | "cyan" }) {
    // 依照明度分色：优秀(>80, 绿)、及格(40-80, 主色)、不及格(<40, 红)
    let colorClass = colorVariant === "cyan"
        ? "text-cyan-700 bg-white border-zinc-100 dark:text-cyan-300 dark:bg-zinc-900 dark:border-white/10"
        : "text-violet-700 bg-white border-zinc-100 dark:text-violet-300 dark:bg-zinc-900 dark:border-white/10";

    if (score >= 80) colorClass = "text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50";
    else if (score < 40) colorClass = "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50";

    return (
        <div className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border ${colorClass} transition-colors whitespace-nowrap`}>
            {label} ({score}%)
        </div>
    );
}
