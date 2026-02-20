'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    RefreshCw,
    Loader2,
    HelpCircle,
    ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { simulateContent } from '@/actions/inspector';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type SimulationResult = {
    rank: number;
    vocabId: number;
    word: string;
    definition_cn: string;
    partOfSpeech: string;
    frequency_score: number;
    priority_level: number;
    bucket: 'REVIEW' | 'NEW';
    stability: number;
    due: Date | string | null;
    reason: string;
};

export function ContentSimView() {
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<SimulationResult[]>([]);
    const [mode, setMode] = useState('L0_MIXED');
    const [limit, setLimit] = useState(20);
    const [stats, setStats] = useState({ vocabCoverage: 0, targetScore: 0 });

    const handleSimulate = (forceRefresh: boolean = false) => {
        startTransition(async () => {
            const result = await simulateContent(undefined, mode, limit, forceRefresh);
            if (result.success && result.data) {
                setData(result.data as SimulationResult[]);
                if (result.stats) {
                    setStats(result.stats as { vocabCoverage: number, targetScore: number });
                }
                if (forceRefresh) toast.success('已强制刷新模拟数据');
            } else {
                toast.error('模拟失败: ' + result.error);
            }
        });
    };

    // Initial fetch
    useEffect(() => {
        handleSimulate(false);
    }, []);

    const modeLabels: Record<string, string> = {
        'L0_MIXED': 'L0 混合模式',
        'SYNTAX': '句法模式 (Syntax)',
        'PHRASE': '词块模式 (Phrase)',
        'L1_MIXED': 'L1 商务进阶'
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">

            {/* Toolbar */}
            <div className="h-auto md:h-20 shrink-0 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:px-8 bg-muted/20 gap-4 md:gap-0">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">模拟时间线</span>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-2xl font-bold text-foreground">Day 1</h2>
                            <span className="text-xs text-violet-500">新手阶段</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mode Selector */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-8 text-xs gap-1 border-dashed">
                                    {modeLabels[mode]}
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setMode('L0_MIXED')}>
                                    L0 混合模式
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMode('SYNTAX')}>
                                    句法模式 (Syntax)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMode('PHRASE')}>
                                    词块模式 (Phrase)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMode('L1_MIXED')}>
                                    L1 商务进阶
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Force Simulate Button */}
                        <button
                            onClick={() => handleSimulate(true)}
                            disabled={isPending}
                            className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded hover:opacity-90 disabled:opacity-50 h-8"
                        >
                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            <span>模拟 (强制)</span>
                        </button>

                        {/* Help Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="p-1 text-muted-foreground hover:text-foreground">
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-bold text-sm mb-1">模式说明</h4>
                                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                                            <li><span className="font-bold text-foreground">L0 混合</span>: 模拟用户每日学习的主模式，混合句法拆解与词块构建。</li>
                                            <li><span className="font-bold text-foreground">句法/词块</span>: 强制算法只筛选特定类型的词汇，用于调试队列。</li>
                                            <li><span className="font-bold text-foreground">L1 商务</span>: 模拟 L1 阶段的商务场景流选词。</li>
                                        </ul>
                                    </div>
                                    <div className="border-t border-border pt-2">
                                        <h4 className="font-bold text-sm mb-1">模拟 (强制)</h4>
                                        <p className="text-xs text-muted-foreground">
                                            强制清空当前模式的 Redis 缓存，模拟<span className="text-amber-500 font-bold">冷启动</span>状态。
                                            用于验证 FSRS 参数调整后的即时选词变化。
                                        </p>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="text-right flex-1 md:flex-none">
                        <div className="text-xs font-bold text-foreground">当前估分: {stats.targetScore}</div>
                        <div className="text-[10px] text-muted-foreground">词汇覆盖率: {stats.vocabCoverage}%</div>
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="w-full max-w-6xl mx-auto border border-border rounded-xl overflow-hidden overflow-x-auto shadow-sm">

                    {/* Table Header */}
                    <div className="min-w-[800px] grid grid-cols-12 gap-4 p-3 bg-muted/50 border-b border-border text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-1">排名</div>
                        <div className="col-span-3">单词</div>
                        <div className="col-span-2">词性</div>
                        <div className="col-span-2">频率</div>
                        <div className="col-span-3">FSRS 状态</div>
                        <div className="col-span-1 text-right">Bucket</div>
                    </div>

                    {/* Table Body */}
                    {isPending && data.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            正在模拟 OMPS 选词...
                        </div>
                    ) : data.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            无数据
                        </div>
                    ) : (
                        data.map((item) => (
                            <div
                                key={item.vocabId}
                                className={cn(
                                    "min-w-[800px] grid grid-cols-12 gap-4 p-4 border-b border-border bg-card items-center hover:bg-muted/50 transition-colors group",
                                    item.bucket === 'REVIEW' && "bg-amber-500/5 hover:bg-amber-500/10"
                                )}
                            >
                                <div className="col-span-1 text-xs font-mono text-muted-foreground">#{item.rank}</div>
                                <div className="col-span-3 flex flex-col">
                                    <span className="text-sm font-bold text-foreground">{item.word}</span>
                                    <span className="text-[10px] text-muted-foreground">{item.definition_cn}</span>
                                </div>
                                <div className="col-span-2 text-xs text-muted-foreground">{item.partOfSpeech}</div>
                                <div className="col-span-2">
                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden" title={`Frequency: ${item.frequency_score}`}>
                                        <div
                                            className="h-full bg-emerald-500"
                                            style={{ width: `${Math.min(item.frequency_score * 10, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="col-span-3">
                                    <span className={cn(
                                        "px-2 py-1 rounded text-[10px] font-bold border",
                                        item.bucket === 'REVIEW'
                                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    )}>
                                        {item.bucket === 'REVIEW' ? '复习' : '新学'}
                                    </span>
                                    <p className="text-[9px] text-muted-foreground mt-1 font-mono">
                                        S:{item.stability.toFixed(1)} | {item.reason}
                                    </p>
                                </div>
                                <div className="col-span-1 text-right text-xs font-mono text-muted-foreground">
                                    {item.priority_level}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
