"use client";

import { useEffect, useState } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
} from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRadarData } from "@/actions/diagnostic-engine";
import type { RadarDataPoint } from "@/lib/services/diagnostic-service";

export function DiagnosticRadar({ userId }: { userId?: string }) {
    const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
    const [weakestLabel, setWeakestLabel] = useState<string | null>(null);
    const [totalAttempts, setTotalAttempts] = useState(0);
    // [W-3 Fix] 使用独立 isLoading state 替代 useTransition(async) 反模式
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getRadarData(userId).then(result => {
            if (cancelled) return;
            setRadarData(result.radarData);
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
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-primary/5 blur-3xl z-0 pointer-events-none" />
            <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2">
                    <span>AI 能力诊断</span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Beta
                    </span>
                </CardTitle>
                <CardDescription>
                    基于 The Arena 最近 {totalAttempts} 题的全景分析。
                    {weakestLabel && (
                        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-100 dark:border-amber-900/50">
                            <span className="font-semibold">今日建议：</span>
                            你的 <b>{weakestLabel}</b> 环节失分较多。今日训练已为你定向组装了针对性挑战。
                        </div>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid strokeOpacity={0.2} />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{
                                    fill: "currentColor",
                                    fontSize: 12,
                                    opacity: 0.8,
                                }}
                            />
                            <Radar
                                name="正确率"
                                dataKey="A"
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--primary))"
                                fillOpacity={0.2}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
