"use client";

import React, { useState } from "react";
// ✅ 引入 Design System 指定的图标库
import {
    X,
    Moon,
    Sun,
    Zap,           // 代表 Blitz 模式
    Type,          // 代表 Syntax 模式
    MoreHorizontal,// 更多菜单
    ArrowLeft,     // 返回
    Play,          // 播放发音
    CheckCircle2,  // Know
    HelpCircle,    // Hazy
    XCircle        // Forgot
} from "lucide-react";
import { cn } from "@/lib/utils"; // 假设你有 shadcn 的 cn 工具，如果没有可以用 clsx 或直接拼字符串

/**
 * OPUS UNIFIED DRILL SHELL (Lucide Icon Version)
 * Strict Adherence to Design System v1.0
 */
export default function DrillPage() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [mode, setMode] = useState<"standard" | "blitz">("standard");

    return (
        <div className={isDarkMode ? "dark" : ""}>

            {/* APP ROOT CONTAINER */}
            <div className="relative h-screen w-full overflow-hidden bg-background text-foreground font-sans antialiased flex flex-col transition-colors duration-500 selection:bg-primary/30">

                {/* ==================== 1. AMBIENT BACKGROUND ==================== */}
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.05)_0%,_transparent_40%)] dark:hidden"></div>
                    <div className="hidden dark:block absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full animate-pulse"></div>
                    <div className="hidden dark:block absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 blur-[100px] rounded-full"></div>
                </div>

                {/* ==================== 2. GLASS HEADER ==================== */}
                <header className="sticky top-0 z-50 w-full h-16 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl transition-all duration-300 flex items-center justify-between px-6">

                    {/* Progress Bar */}
                    <div className="flex-1 max-w-[120px]">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full w-[65%] bg-primary rounded-full dark:shadow-[0_0_10px_rgba(129,140,248,0.5)] transition-all duration-500"></div>
                        </div>
                    </div>

                    {/* Meta Label: 带图标的胶囊 */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card/50 backdrop-blur-md text-xs font-medium uppercase tracking-wider text-muted-foreground shadow-sm">
                        {/* ✅ 使用 Lucide 图标: Stroke 1.5 */}
                        {mode === "standard" ? (
                            <Type className="w-3 h-3" strokeWidth={1.5} />
                        ) : (
                            <Zap className="w-3 h-3" strokeWidth={1.5} />
                        )}
                        <span>{mode === "standard" ? "Syntax Drill" : "Phrase Blitz"}</span>
                    </div>

                    {/* Exit Icon */}
                    <button className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95 -mr-2">
                        {/* ✅ 使用 Lucide X 图标 */}
                        <X className="w-6 h-6" strokeWidth={1.5} />
                    </button>
                </header>


                {/* ==================== 3. THE CORE ==================== */}
                <main className="relative z-10 flex-1 flex flex-col w-full h-full max-w-2xl mx-auto">

                    {/* SLOT A: STIMULUS ZONE (60%) */}
                    <div className="flex-1 flex flex-col items-center justify-center px-6 w-full relative transition-all duration-500">
                        {mode === "standard" ? <SyntaxStimulus /> : <BlitzStimulus />}
                    </div>

                    {/* SLOT B: INTERACTION ZONE (40%) */}
                    <div className="w-full shrink-0 pb-12 pt-4 px-6 transition-all duration-500">
                        {mode === "standard" ? <SyntaxInteraction /> : <BlitzInteraction />}
                    </div>

                </main>

                {/* ==================== DEV TOOLS (Iconized) ==================== */}
                <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 items-end">

                    {/* Theme Toggle */}
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 flex items-center justify-center bg-card border border-border rounded-lg shadow-xl hover:scale-105 transition-transform text-foreground">
                        {isDarkMode ? <Sun className="w-5 h-5" strokeWidth={1.5} /> : <Moon className="w-5 h-5" strokeWidth={1.5} />}
                    </button>

                    {/* Mode Switchers */}
                    <div className="flex flex-col gap-2 p-2 bg-card/80 backdrop-blur border border-border rounded-xl shadow-xl">
                        <button onClick={() => setMode("standard")} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'standard' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}>
                            <Type className="w-4 h-4" strokeWidth={1.5} />
                            <span>Syntax</span>
                        </button>
                        <button onClick={() => setMode("blitz")} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'blitz' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}>
                            <Zap className="w-4 h-4" strokeWidth={1.5} />
                            <span>Blitz</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

/* --------------------------------------------------
   SUB-COMPONENTS
   -------------------------------------------------- */

// --- 1. SYNTAX CORE ---

function SyntaxStimulus() {
    const cardStyles = "relative w-full max-w-md rounded-2xl border transition-all duration-300 bg-card text-card-foreground border-border shadow-sm dark:bg-white/5 dark:backdrop-blur-md dark:border-white/10 dark:shadow-none p-8 flex flex-col items-center min-h-[260px] justify-center animate-in zoom-in-95 duration-300";

    return (
        <div className={cardStyles}>
            <h2 className="font-serif text-3xl md:text-4xl leading-[3rem] text-center text-foreground">
                <span className="relative inline-block mx-1">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg">The team</span>
                </span>
                <span className="inline-flex flex-col items-center justify-end mx-2 align-baseline w-[60px]">
                    <span className="w-full h-[2px] bg-border"></span>
                </span>
                <span className="text-muted-foreground mx-1">the</span>
                <span className="relative inline-block mx-1">
                    <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg">proposal</span>
                </span>
                <span className="text-muted-foreground">.</span>
            </h2>

            <div className="mt-8 pt-4 w-full border-t border-border flex justify-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    Context: Meeting
                </p>
            </div>
        </div>
    );
}

function SyntaxInteraction() {
    const btnClasses = "group relative h-full w-full rounded-2xl border transition-all duration-200 active:scale-[0.98] flex flex-col items-center justify-center gap-2 bg-card border-border hover:border-primary/50 hover:bg-primary/5 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10";

    return (
        <div className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-300">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">Select the missing verb</p>
            <div className="grid grid-cols-2 gap-4 h-40">
                <button className={btnClasses}>
                    <span className="font-serif text-2xl font-medium text-foreground">accept</span>
                </button>
                <button className={btnClasses}>
                    <span className="font-serif text-2xl font-medium text-foreground">accepted</span>
                </button>
            </div>
        </div>
    );
}

// --- 2. BLITZ CORE ---

function BlitzStimulus() {
    return (
        <div className="w-full max-w-lg text-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="relative inline-block">
                <h2 className="font-serif text-3xl md:text-4xl leading-relaxed text-foreground">
                    accept an
                    <span className="relative inline-block mx-1">
                        <span className="relative z-10 px-3 py-1 rounded-lg bg-primary/15 text-primary font-bold border-b-2 border-primary/30 dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]">offer</span>
                    </span>
                    from the company
                </h2>

                {/* Play Button Action (Optional) */}
                <button className="absolute -right-12 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Play className="w-5 h-5 fill-current opacity-50" strokeWidth={1.5} />
                </button>
            </div>

            <div className="space-y-2">
                <p className="text-xl text-muted-foreground font-medium">
                    接受公司的<span className="text-primary font-bold">录用通知</span>
                </p>
            </div>
        </div>
    );
}

function BlitzInteraction() {
    // 定义 FSRS 按钮的通用样式结构
    const actionBtnBase = "relative h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm overflow-hidden group";

    return (
        <div className="w-full max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground animate-pulse">FSRS Rating</p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full">

                {/* Forgot (Red) */}
                <button className={`${actionBtnBase} border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400`}>
                    {/* 图标在 Hover 时轻微上浮 */}
                    <XCircle className="w-6 h-6 mb-1 group-hover:-translate-y-0.5 transition-transform" strokeWidth={1.5} />
                    <span className="text-xs font-bold uppercase tracking-wider">Forgot</span>
                </button>

                {/* Hazy (Amber) */}
                <button className={`${actionBtnBase} border-amber-200 bg-amber-50/50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400`}>
                    <HelpCircle className="w-6 h-6 mb-1 group-hover:-translate-y-0.5 transition-transform" strokeWidth={1.5} />
                    <span className="text-xs font-bold uppercase tracking-wider">Hazy</span>
                </button>

                {/* Know (Emerald) */}
                <button className={`${actionBtnBase} border-emerald-200 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400`}>
                    <CheckCircle2 className="w-6 h-6 mb-1 group-hover:-translate-y-0.5 transition-transform" strokeWidth={1.5} />
                    <span className="text-xs font-bold uppercase tracking-wider">Know</span>
                </button>

            </div>
        </div>
    );
}