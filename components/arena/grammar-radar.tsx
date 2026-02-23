"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { getRadarData, type RadarDomain } from "@/actions/grammar-dashboard";
import { RadarChart } from "@/components/arena/radar-chart";

export function GrammarRadar({ initialData }: { initialData?: RadarDomain[] }) {
    const [radarDomains, setRadarDomains] = useState<RadarDomain[]>(initialData || []);
    const [isLoading, setIsLoading] = useState(!initialData);

    useEffect(() => {
        if (initialData) return; // If initialData is provided, no need to fetch
        let cancelled = false;
        setIsLoading(true);
        getRadarData().then(result => {
            if (cancelled) return;
            setRadarDomains(result);
        }).catch(error => {
            console.error("Failed to fetch grammar radar data", error);
        }).finally(() => {
            if (!cancelled) setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, [initialData]);

    if (isLoading) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center">
                    <Skeleton className="h-48 w-48 rounded-full" />
                </CardContent>
            </Card>
        );
    }

    if (radarDomains.length === 0 || radarDomains.every(d => d.score === 0)) {
        return (
            <Card className="w-full relative overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <span>专精语法树</span>
                        <span className="text-[10px] font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase">
                            L1 专精领域 (DOMAINS)
                        </span>
                    </CardTitle>
                    <CardDescription>
                        完成 Arena 实战答题后，这里将展示你的语法树分析。
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[100px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">暂无数据，去 Arena 答几道题吧！</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full relative overflow-hidden">
            {/* 背景装点 */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-indigo-500/5 blur-3xl z-0 pointer-events-none" />
            <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <span>专精语法树</span>
                    <Popover>
                        <PopoverTrigger className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                            <HelpCircle className="w-4 h-4" />
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg text-sm text-transform-none focus:outline-none z-50">
                            <div className="space-y-2">
                                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 normal-case tracking-normal">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>微观靶向追踪引擎
                                </h4>
                                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-xs normal-case tracking-normal font-sans">
                                    基于先进的 BKT (知识追踪) 算法，过滤了猜测与失误的噪音数据。这里的节点掌握度将被出题引擎锁定，从而针对你最薄弱的特定语法点生成题目。
                                </p>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <span className="text-[10px] font-mono font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50 uppercase">
                        L1 专精领域 (DOMAINS)
                    </span>
                </CardTitle>
                <CardDescription>
                    基于你在实战演练中积累的语法盲点追踪。
                </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 pb-6">
                <div className="flex items-center justify-center w-full min-h-[220px]">
                    <RadarChart domains={radarDomains} />
                </div>
            </CardContent>
        </Card>
    );
}
