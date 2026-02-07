'use client';

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Zap, Volume2, Brain } from 'lucide-react';

// --- CVA Definition ---
const modeCardVariants = cva(
    "relative overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 border-l-4 group",
    {
        variants: {
            mode: {
                "speed-run": "border-l-emerald-500 hover:shadow-lg dark:hover:shadow-emerald-900/20",
                "audio-gym": "border-l-blue-500 hover:shadow-lg dark:hover:shadow-blue-900/20",
                "context-lab": "border-l-violet-500 hover:shadow-lg dark:hover:shadow-violet-900/20",
            },
        },
        defaultVariants: {
            mode: "speed-run",
        },
    }
);

interface ModeConfig {
    id: "speed-run" | "audio-gym" | "context-lab";
    title: string;
    desc: string;
    level: string;
    subModes: string[];
    icon: typeof Zap;
    colorClass: string;
    batchSize: number;
    href: string;
}

const MODES: ModeConfig[] = [
    {
        id: "speed-run",
        title: "极速挑战",
        desc: "快速刷词，建立形义连接。",
        level: "L0 基础",
        subModes: ["语法", "闪词"],
        icon: Zap,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        batchSize: 20,
        href: "/dashboard/session/SYNTAX",
    },
    {
        id: "audio-gym",
        title: "听力训练",
        desc: "盲听训练，情感语音，意群断句。",
        level: "L1 进阶",
        subModes: ["短语", "语块", "听力"],
        icon: Volume2,
        colorClass: "text-blue-600 dark:text-blue-400",
        batchSize: 20,
        href: "/dashboard/session/PHRASE",
    },
    {
        id: "context-lab",
        title: "情境实验室",
        desc: "商务长难句填空，精准用词辨析。",
        level: "L2 塔尖",
        subModes: ["情境", "辨析"],
        icon: Brain,
        colorClass: "text-violet-600 dark:text-violet-400",
        batchSize: 20,
        href: "/dashboard/session/CONTEXT",
    },
];

// ... (previous imports)
import { useEffect } from 'react';
import { prefetchDrills } from '@/actions/prefetch-drills';

import { Header } from '@/components/ui/header';

export default function SimulatePage() {
    // ⚡️ Trigger Prefetch on Mount
    useEffect(() => {
        // Fire and forget - don't block UI
        prefetchDrills();
    }, []);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24 relative overflow-hidden">
            {/* Background Glow Removed */}

            {/* Header */}
            <Header variant="default" title="模拟训练" className="sticky top-0" />

            {/* Content */}
            <div className="p-6 space-y-4 relative z-10">
                <div className="space-y-1 mb-6">
                    <p className="text-muted-foreground">选择你的训练模拟课目。</p>
                </div>

                {/* Grid */}
                <div className="grid gap-4">
                    {MODES.map((mode) => {
                        const Icon = mode.icon;
                        return (
                            <Link key={mode.id} href={mode.href}>
                                <Card className={cn(modeCardVariants({ mode: mode.id }))}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("p-2 rounded-lg bg-background/50 backdrop-blur-sm", mode.colorClass)}>
                                                <Icon className="w-5 h-5 stroke-2" />
                                            </div>
                                            <h2 className="font-semibold text-lg">{mode.title}</h2>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {mode.level}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {mode.desc}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="pt-0 flex gap-2 flex-wrap">
                                        {mode.subModes.map((sub) => (
                                            <Badge key={sub} variant="secondary" className="text-[10px] font-normal">
                                                {sub}
                                            </Badge>
                                        ))}
                                    </CardFooter>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
