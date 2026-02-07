/**
 * 缓存统计卡片组件 (HUD Ammo Depot Design)
 * 对应参考设计：Inventory Monitor
 */
'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
    Wrench,       // L0: Mechanics
    Activity,     // L1: Rhythm/Flow
    Brain,        // L2: Cognitive
    Database,     // Icon
    MoreHorizontal
} from 'lucide-react';

interface CacheStatsCardProps {
    stats: {
        SYNTAX: number;
        PHRASE: number;
        CHUNKING: number;
        AUDIO: number;
        NUANCE: number;
        READING: number;
        total: number;
        targets: Record<string, number>;
    };
}


// 模式分组配置
const MODE_GROUPS = [
    {
        level: 'L0',
        label: '基础训练 (Foundation)',
        subLabel: '语法 & 短语',
        color: 'emerald',
        icon: Wrench,
        modes: [
            { key: 'SYNTAX', label: '语法 (Syntax)' },
            { key: 'PHRASE', label: '短语 (Phrase)' },
        ]
    },
    {
        level: 'L1',
        label: '韵律训练 (Rhythm)',
        subLabel: '听力 & 分块',
        color: 'sky',
        icon: Activity,
        modes: [
            { key: 'CHUNKING', label: '语块 (Chunking)' },
            { key: 'AUDIO', label: '听力 (Audio)' },
        ]
    },
    {
        level: 'L2',
        label: '认知训练 (Cognitive)',
        subLabel: '细微差异 & 逻辑',
        color: 'violet',
        icon: Brain,
        modes: [
            { key: 'NUANCE', label: '辨析 (Nuance)' },
            { key: 'READING', label: '阅读 (Reading)' },
        ]
    }
];

export function CacheStatsCard({ stats }: CacheStatsCardProps) {
    return (
        <div className="md:col-span-2 rounded-3xl border border-border bg-card/50 backdrop-blur-xl p-5 shadow-sm flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-3 h-3" />
                        库存监控
                    </h3>
                </div>
                <div className="text-right">
                    <div className="text-xl font-mono font-bold text-foreground leading-none">
                        {stats.total}
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                {MODE_GROUPS.map((group) => (
                    <TrackCard
                        key={group.level}
                        group={group}
                        stats={stats}
                    />
                ))}
            </div>
        </div>
    );
}

function TrackCard({
    group,
    stats,
}: {
    group: typeof MODE_GROUPS[0];
    stats: {
        targets: Record<string, number>;
        [key: string]: number | Record<string, number>;
    };
}) {
    const colorMap = {
        emerald: {
            border: 'border-emerald-500/20 group-hover:border-emerald-500/30',
            bg: 'bg-emerald-500/5',
            icon: 'text-emerald-500',
            bar: 'bg-emerald-500',
            text: 'text-emerald-500',
        },
        sky: {
            border: 'border-sky-500/20 group-hover:border-sky-500/30',
            bg: 'bg-sky-500/5',
            icon: 'text-sky-500',
            bar: 'bg-sky-500',
            text: 'text-sky-500',
        },
        violet: {
            border: 'border-violet-500/20 group-hover:border-violet-500/30',
            bg: 'bg-violet-500/5',
            icon: 'text-violet-500',
            bar: 'bg-violet-500',
            text: 'text-violet-500',
        },
    };

    const style = colorMap[group.color as keyof typeof colorMap];
    const Icon = group.icon;

    return (
        <div className={cn(
            "group relative rounded-xl border p-4 transition-all duration-300",
            style.border,
            style.bg
        )}>
            {/* Track Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-1.5 rounded-md bg-background/50 backdrop-blur-sm border shadow-sm", style.border)}>
                    <Icon className={cn("w-3.5 h-3.5", style.icon)} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", style.border, style.bg, style.text)}>
                            {group.level}
                        </span>
                        <span className="text-xs font-bold text-foreground">{group.label}</span>
                    </div>
                </div>
            </div>

            {/* Modes List */}
            <div className="space-y-3">
                {group.modes.map((mode) => {
                    const count = (stats[mode.key] as number) || 0;
                    const target = stats.targets?.[mode.key] || 50;
                    const percent = Math.min((count / target) * 100, 100);

                    return (
                        <div key={mode.key} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                                    {mode.label}
                                </span>
                                <span className="text-xs font-mono font-bold text-foreground">
                                    {count} <span className="text-[10px] text-muted-foreground font-normal">/ {target}</span>
                                </span>
                            </div>

                            {/* Custom Micro Progress Bar */}
                            <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-500", style.bar)}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        </div>
                    );
                })
                }
            </div>

            {/* Status Dot (Absolute) */}
            <div className="absolute top-4 right-4 flex gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", style.bar)} />
            </div>
        </div>
    );
}
