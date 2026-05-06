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
import { getRadarData } from "@/actions/diagnostic-engine";
import type { RadarDataPoint } from "@/lib/services/diagnostic-service";
import { RadarChart } from "@/components/arena/radar-chart";
import type { RadarDomain } from "@/lib/backend-core/arena/dashboard";

export function DiagnosticRadar({ userId }: { userId?: string }) {
    const [radarData, setRadarData] = useState<RadarDomain[]>([]);
    const [weakestLabel, setWeakestLabel] = useState<string | null>(null);
    const [totalAttempts, setTotalAttempts] = useState(0);
    // [W-3 Fix] 使用独立 isLoading state 替代 useTransition(async) 反模式
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getRadarData(userId).then(result => {
            if (cancelled) return;
            // 转换为 RadarDomain 格式以复用自定义 RadarChart
            const mappedData: RadarDomain[] = result.radarData.map(d => ({
                code: d.subject,
                label: d.subject,
                score: d.A
            }));
            setRadarData(mappedData);
            setWeakestLabel(result.weakest?.label ?? null);
            setTotalAttempts(result.totalAttempts);
        }).catch(error => {
            console.error("Failed to fetch diagnostics", error);
        }).finally(() => {
            if (!cancelled) setIsLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId]);

    // Loading skeleton
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

    // 空状态：还没做过题
    if (radarData.length === 0) {
        return (
            <Card className="w-full relative overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <span>AI 能力诊断</span>
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                            Beta
                        </span>
                    </CardTitle>
                    <CardDescription>
                        完成 Arena 实战答题后，这里将展示你的全景能力分析。
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
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-cyan-500/5 blur-3xl z-0 pointer-events-none" />
            <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <span>综合题型诊断</span>
                    <Popover>
                        <PopoverTrigger className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                            <HelpCircle className="w-4 h-4" />
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-lg text-sm">
                            <div className="space-y-2">
                                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>宏观题型调度引擎
                                </h4>
                                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-xs">
                                    基于您在 Arena 实战中的原始做题记录统计。这里的表现决定了系统每天为您生成何种题型的题目（如重点补足阅读或纯语法）。
                                </p>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <span className="text-xs font-normal text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 px-2 py-0.5 rounded-full border border-cyan-100 dark:border-cyan-900/50">
                        Beta
                    </span>
                </CardTitle>
                <CardDescription>
                    基于 The Arena 最近 {totalAttempts} 题的全景分析。
                    {weakestLabel && (
                        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-100 dark:border-amber-900/50">
                            <span className="font-semibold">今日建议：</span>
                            你的 <b className="font-bold">{weakestLabel}</b> 环节失分较多。今日训练已为你定向组装了针对性挑战。
                        </div>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 pb-6">
                <div className="flex items-center justify-center w-full min-h-[220px]">
                    <RadarChart domains={radarData} colorVariant="cyan" />
                </div>
            </CardContent>
        </Card>
    );
}
