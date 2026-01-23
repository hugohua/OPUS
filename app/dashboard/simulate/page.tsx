'use client';

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cva, VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Zap, Puzzle, Scale } from 'lucide-react';

// --- CVA Definition ---
const modeCardVariants = cva(
    "relative overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 border-l-4 group",
    {
        variants: {
            mode: {
                SYNTAX: "border-l-teal-500 hover:shadow-lg dark:hover:shadow-teal-900/20",
                CHUNKING: "border-l-blue-500 hover:shadow-lg dark:hover:shadow-blue-900/20",
                NUANCE: "border-l-violet-500 hover:shadow-lg dark:hover:shadow-violet-900/20",
                BLITZ: "border-l-orange-500 hover:shadow-lg dark:hover:shadow-orange-900/20",
            },
        },
        defaultVariants: {
            mode: "SYNTAX",
        },
    }
);

interface ModeConfig {
    id: "SYNTAX" | "CHUNKING" | "NUANCE" | "BLITZ";
    title: string;
    desc: string;
    icon: typeof Zap;
    colorClass: string;
    batchSize: number;
    backlog: number;
    href: string;
}

const MODES: ModeConfig[] = [
    {
        id: "BLITZ",
        title: "Phrase Blitz",
        desc: "High-velocity review. Context-first, low friction.",
        icon: Zap,
        colorClass: "text-orange-600 dark:text-orange-400",
        batchSize: 20,
        backlog: 5, // Mock
        href: "/blitz",
    },
    {
        id: "SYNTAX",
        title: "Syntax Drill",
        desc: "Repair broken grammar logic. Survive S-V-O.",
        icon: Zap,
        colorClass: "text-teal-600 dark:text-teal-400",
        batchSize: 20,
        backlog: 12, // Mock
        href: "/dashboard/session/SYNTAX",
    },
    {
        id: "CHUNKING",
        title: "Chunking Flow",
        desc: "Master fixed phrases and business collocations.",
        icon: Puzzle,
        colorClass: "text-blue-600 dark:text-blue-400",
        batchSize: 30,
        backlog: 0,
        href: "/dashboard/session/CHUNKING",
    },
    {
        id: "NUANCE",
        title: "Nuance Audit",
        desc: "Precision wording for executive decisions.",
        icon: Scale,
        colorClass: "text-violet-600 dark:text-violet-400",
        batchSize: 50,
        backlog: 5,
        href: "/dashboard/session/NUANCE",
    },
];

export default function SimulatePage() {
    return (
        <div className="p-6 space-y-6 pb-24">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Simulate</h1>
                <p className="text-muted-foreground">Choose your training simulation.</p>
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
                                    {mode.backlog > 0 && (
                                        <Badge variant="destructive" className="animate-pulse">
                                            {mode.backlog} Due
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {mode.desc}
                                    </p>
                                </CardContent>
                                <CardFooter className="pt-0 flex gap-2">
                                    <Badge variant="outline" className="text-xs font-normal">
                                        Batch: {mode.batchSize}
                                    </Badge>
                                    {/* Level Indicator? */}
                                </CardFooter>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
