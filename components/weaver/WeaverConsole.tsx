"use client";

import React, { useEffect, useState } from "react";
import { getWeaverIngredients } from "@/actions/weaver-selection"; // Server Action
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, TrendingUp, Cpu, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

// ============================================
// Types & Constants
// ============================================

type ScenarioType = "finance" | "hr" | "marketing" | "rnd";

const SCENARIOS = [
    { id: "finance", label: "Finance", icon: TrendingUp, desc: "Mergers, IPOs, Audit", color: "text-emerald-500", bg: "bg-emerald-500/10 dark:bg-emerald-500/20" },
    { id: "hr", label: "Human Resources", icon: Users, desc: "Hiring, Culture, Policy", color: "text-blue-500", bg: "bg-blue-500/10 dark:bg-blue-500/20" },
    { id: "marketing", label: "Marketing", icon: Sparkles, desc: "Branding, Growth, Ads", color: "text-violet-500", bg: "bg-violet-500/10 dark:bg-violet-500/20" },
    { id: "rnd", label: "R&D", icon: Cpu, desc: "Innovation, Tech Stack", color: "text-amber-500", bg: "bg-amber-500/10 dark:bg-amber-500/20" },
] as const;

interface WordItem {
    id: number;
    word: string;
    meaning: string;
}

interface WeaverConsoleProps {
    onStart: (scenario: string, words: WordItem[]) => void;
}

/**
 * Weaver Console (Setup Phase)
 * 功能：
 * 1. 自动加载 FSRS 推荐词汇 (Priority Queue)
 * 2. 选择商务场景 (Scenario)
 * 3. 启动生成 (Start Weaver)
 */
export function WeaverConsole({ onStart }: WeaverConsoleProps) {
    const { data: session } = useSession();
    const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("finance");
    const [priorityWords, setPriorityWords] = useState<WordItem[]>([]);
    const [fillerWords, setFillerWords] = useState<WordItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Load Ingredients on Mount
    useEffect(() => {
        if (!session?.user?.id) return;

        loadIngredients(session.user.id, selectedScenario);
    }, [session?.user?.id, selectedScenario]);

    async function loadIngredients(userId: string, scenario: string) {
        setIsLoading(true);
        setError(null);
        try {
            const res = await getWeaverIngredients(userId, scenario);
            if (res.status === "success" && res.data) {
                setPriorityWords(res.data.priorityWords);
                setFillerWords(res.data.fillerWords);
            } else {
                setError(res.message || "Failed to load ingredients");
                toast.error("Failed to load vocabulary");
            }
        } catch (err) {
            console.error(err);
            setError("Network Error");
        } finally {
            setIsLoading(false);
        }
    }

    const totalCount = priorityWords.length + fillerWords.length;

    return (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* Header */}
            <header className="text-center space-y-2 mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-wider uppercase mb-2">
                    <Briefcase className="w-3 h-3" />
                    Opus Weaver Lab v2
                </div>
                <h1 className="text-4xl font-serif font-black text-primary tracking-tight">
                    Design Your Briefing
                </h1>
                <p className="text-secondary max-w-md mx-auto">
                    Select a context. Opus will weave your due words into a professional reading session.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                {/* LEFT: Ingredients (Data Flow) */}
                <div className="md:col-span-5 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-secondary text-xs uppercase tracking-wider">Queue Payload</h3>
                        <Badge variant="outline" className="font-mono text-[10px] text-zinc-400 border-border">
                            {isLoading ? "SYNCING..." : `${totalCount} WORDS`}
                        </Badge>
                    </div>

                    <Card className="p-4 bg-muted/30 border-border shadow-sm min-h-[320px] relative overflow-hidden backdrop-blur-sm">
                        {isLoading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/50 backdrop-blur-sm z-10">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                <span className="text-xs font-mono text-muted-foreground">Fetching due words...</span>
                            </div>
                        ) : error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-rose-500">
                                <AlertCircle className="w-8 h-8" />
                                <span className="text-xs font-bold">{error}</span>
                                <Button variant="outline" size="sm" onClick={() => session?.user?.id && loadIngredients(session.user.id, selectedScenario)}>Retry</Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Priority Queue */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-rose-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Priority (Due)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {priorityWords.map(w => (
                                            <Badge key={w.id} variant="secondary" className="bg-background hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 text-foreground font-normal transition-colors">
                                                {w.word}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Filler Queue */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Context Fillers</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {fillerWords.map(w => (
                                            <Badge key={w.id} variant="outline" className="border-border text-muted-foreground font-normal">
                                                {w.word}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* RIGHT: Scenario Selector (Control Flow) */}
                <div className="md:col-span-7 space-y-4">
                    <h3 className="font-bold text-secondary text-xs uppercase tracking-wider px-1">Target Scenario</h3>

                    <div className="grid grid-cols-2 gap-3">
                        {SCENARIOS.map(s => {
                            const Icon = s.icon;
                            const isSelected = selectedScenario === s.id;

                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedScenario(s.id as ScenarioType)}
                                    className={cn(
                                        "relative group flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-left",
                                        isSelected
                                            ? `border-${s.color.split('-')[1]}-500 bg-card shadow-md ring-1 ring-${s.color.split('-')[1]}-200 dark:ring-0`
                                            : "border-transparent bg-card hover:border-border hover:bg-muted/50"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-lg transition-colors", s.bg, s.color)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className={cn("block font-bold text-sm", isSelected ? "text-primary" : "text-muted-foreground")}>
                                            {s.label}
                                        </span>
                                        <span className="text-xs text-secondary font-medium">
                                            {s.desc}
                                        </span>
                                    </div>

                                    {isSelected && (
                                        <div className="absolute top-3 right-3 text-indigo-500 animate-in zoom-in-50">
                                            <div className="w-2 h-2 rounded-full bg-current"></div>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <div className="pt-6">
                        <Button
                            className="w-full h-12 text-lg font-serif font-bold tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xl shadow-zinc-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99]"
                            disabled={isLoading || totalCount === 0}
                            onClick={() => onStart(selectedScenario, [...priorityWords, ...fillerWords])}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-5 w-5 fill-current" />
                            )}
                            Initialize Weaver
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
