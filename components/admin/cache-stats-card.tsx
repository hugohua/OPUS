/**
 * 缓存统计卡片组件
 * 对应参考设计：Cache Inventory
 */
'use client';

import { cn } from '@/lib/utils';

interface CacheStatsCardProps {
    stats: {
        SYNTAX: number;
        CHUNKING: number;
        NUANCE: number;
        BLITZ: number;
        total: number;
    };
}

export function CacheStatsCard({ stats }: CacheStatsCardProps) {
    return (
        <div className="md:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-sm">
            <h3 className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-widest mb-6 flex justify-between items-center">
                <span>库存缓存 (Inventory)</span>
                <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">总计: {stats.total}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModeItem label="Syntax" value={stats.SYNTAX} color="emerald" />
                <ModeItem label="Chunking" value={stats.CHUNKING} color="sky" />
                <ModeItem label="Nuance" value={stats.NUANCE} color="violet" />
                <ModeItem label="Blitz" value={stats.BLITZ} color="amber" />
            </div>
        </div>
    );
}

function ModeItem({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: 'emerald' | 'sky' | 'violet' | 'amber';
}) {
    const styles = {
        emerald: {
            bg: 'bg-emerald-500/5',
            border: 'border-emerald-500/20',
            dot: 'bg-emerald-500',
            text: 'text-emerald-100',
            value: 'text-emerald-500'
        },
        sky: {
            bg: 'bg-sky-500/5',
            border: 'border-sky-500/20',
            dot: 'bg-sky-500',
            text: 'text-sky-100',
            value: 'text-sky-500'
        },
        violet: {
            bg: 'bg-violet-500/5',
            border: 'border-violet-500/20',
            dot: 'bg-violet-500',
            text: 'text-violet-100',
            value: 'text-zinc-600 dark:text-violet-500' // Modified to follow reference logic but keep visibility
        },
        amber: {
            bg: 'bg-amber-500/5',
            border: 'border-amber-500/20',
            dot: 'bg-amber-500',
            text: 'text-amber-100',
            value: 'text-zinc-600 dark:text-amber-500'
        }
    };

    const s = styles[color];

    return (
        <div className={cn("flex items-center justify-between p-3 rounded-xl border", s.border, s.bg)}>
            <div className="flex items-center gap-3">
                <div className={cn("h-2 w-2 rounded-full", s.dot)}></div>
                <span className={cn("text-sm font-medium", s.text)}>{label}</span>
            </div>
            <span className={cn("font-mono text-lg font-bold", s.value)}>{value} 道</span>
        </div>
    );
}
