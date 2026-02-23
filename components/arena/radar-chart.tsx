"use client";

import { useEffect, useState } from "react";
import type { RadarDomain } from "@/actions/grammar-dashboard";

export interface RadarChartProps {
    domains: RadarDomain[];
    /** 预期顺序：0=Verbs(上), 1=Nouns(右上), 2=Conj.(右下), 3=Syntax(左下), 4=Clauses(左上) */
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
export function RadarChart({ domains }: RadarChartProps) {
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

    return (
        <div className="relative w-full aspect-square max-w-[220px] mx-auto mb-2">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* 1. 背景五边形轮廓 (Full & Mid) */}
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
                    className="text-violet-500 fill-violet-500/15 dark:fill-violet-500/20 drop-shadow-sm transition-all duration-700 ease-out"
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
                            fill={isWeak ? "#f43f5e" : "#8b5cf6"} // Rose-500 or Violet-500
                            stroke="white"
                            strokeWidth="0.5"
                            className={`transition-all duration-700 ease-out ${isWeak ? 'animate-pulse drop-shadow-sm' : ''}`}
                        />
                    );
                })}
            </svg>

            {/* 外层绝对定位标签 (5 个轴向) */}
            {domains.length === 5 && (
                <>
                    {/* Top: Verbs */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1">
                        <HoverBadge score={domains[0].score} label={domains[0].label} />
                    </div>
                    {/* Top Right: Nouns/Lexical */}
                    <div className="absolute top-1/4 right-0 -mr-2">
                        <HoverBadge score={domains[1].score} label={domains[1].label} />
                    </div>
                    {/* Bottom Right: Conj/Connectives */}
                    <div className="absolute bottom-6 right-0">
                        <HoverBadge score={domains[2].score} label={domains[2].label} />
                    </div>
                    {/* Bottom Left: Syntax */}
                    <div className="absolute bottom-6 left-0">
                        <HoverBadge score={domains[3].score} label={domains[3].label} />
                    </div>
                    {/* Top Left: Clauses */}
                    <div className="absolute top-1/4 left-0 -ml-2">
                        <HoverBadge score={domains[4].score} label={domains[4].label} />
                    </div>
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Hover/Score Label 子组件
// ---------------------------------------------------------------------------

function HoverBadge({ score, label }: { score: number; label: string }) {
    // 依照明度分色：优秀(>80, 绿)、及格(40-80, 靛紫)、不及格(<40, 红)
    let colorClass = "text-violet-700 bg-white border-zinc-100 dark:text-violet-300 dark:bg-zinc-900 dark:border-white/10";
    if (score >= 80) colorClass = "text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50";
    else if (score < 40) colorClass = "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50";

    return (
        <div className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border ${colorClass} transition-colors`}>
            {label} ({score}%)
        </div>
    );
}
