"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, X as XIcon } from "lucide-react";
import { GradingHelp } from "./grading-help";

// ============================================
// Types
// ============================================

export type ControlDeckMode =
    | "reveal"      // Spacebar (Show Answer)
    | "binary"      // 1/2 (Incorrect/Correct)
    | "grade"       // 1/2/3/4 (FSRS)
    | "options"     // 1/2/3/4 (ABCD)
    | "continue";   // Spacebar (Next)

interface ControlDeckProps {
    mode: ControlDeckMode;
    onAction: (action: string) => void; // "reveal", "1", "2", "3", "4", "continue"
    disabled?: boolean;
    className?: string;
    // Optional overrides
    labels?: { [key: string]: string };
    /** FSRS 预览间隔 (来自 previewIntervals()) */
    gradeIntervals?: {
        again: string;
        hard: string;
        good: string;
        easy: string;
    };
}

// ============================================
// Component
// ============================================

export function ControlDeck({
    mode,
    onAction,
    disabled = false,
    className,
    labels = {},
    gradeIntervals
}: ControlDeckProps) {

    // --- Keyboard Bindings ---
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            // Ignore if typing in input
            if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

            switch (e.code) {
                case "Space":
                case "Enter":
                    e.preventDefault();
                    if (mode === "reveal") onAction("reveal");
                    if (mode === "continue") onAction("continue");
                    break;
                case "Digit1":
                case "Numpad1":
                    if (mode !== "reveal" && mode !== "continue") onAction("1");
                    break;
                case "Digit2":
                case "Numpad2":
                    if (mode !== "reveal" && mode !== "continue") onAction("2");
                    break;
                case "Digit3":
                case "Numpad3":
                    if (mode === "grade" || mode === "options") onAction("3");
                    break;
                case "Digit4":
                case "Numpad4":
                    if (mode === "grade" || mode === "options") onAction("4");
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, disabled, onAction]);


    // ============================================
    // MODE: REVEAL / CONTINUE (Spacebar)
    // ============================================
    if (mode === "reveal" || mode === "continue") {
        const isContinue = mode === "continue";
        const label = labels.main || (isContinue ? "Next Challenge" : "Show Answer");
        const subLabel = isContinue ? "Press Space" : "Tap Space to Reveal";

        return (
            <div className={cn("w-full transition-all duration-300", className)}>
                <button
                    onClick={() => onAction(mode)}
                    disabled={disabled}
                    className={cn( // button class
                        "group relative w-full h-16 rounded-xl shadow-[0_4px_0_#1e293b] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center overflow-hidden",
                        isContinue
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_0_#312e81]" // Indigo for Next
                            : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-[0_4px_0_#d4d4d8] dark:shadow-[0_4px_0_#000]" // White/Dark for Reveal
                    )}
                >
                    {/* Key Hint */}
                    <div className={cn(
                        "absolute left-4 px-1.5 py-0.5 rounded border text-[9px] font-mono opacity-60 group-hover:opacity-100 transition-opacity",
                        isContinue
                            ? "border-indigo-400 bg-indigo-700 text-indigo-100"
                            : "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                        SPACE
                    </div>

                    <span className="text-sm font-bold tracking-widest uppercase">
                        {label}
                    </span>

                    {/* Icon */}
                    <div className="absolute right-6 opacity-80 group-hover:translate-x-1 transition-transform">
                        {isContinue ? <ArrowLeft className="w-5 h-5 rotate-180" /> : <SpaceIcon className="w-5 h-5" />}
                    </div>
                </button>
                <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-3 font-mono">
                    {subLabel}
                </p>
            </div>
        );
    }

    // ============================================
    // MODE: BINARY (2 Options)
    // ============================================
    if (mode === "binary") {
        return (
            <div className={cn("grid grid-cols-2 gap-4 w-full h-24", className)}>
                {/* Option 1 (Incorrect) */}
                <button
                    onClick={() => onAction("1")}
                    disabled={disabled}
                    className="group relative h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all active:scale-[0.98] shadow-sm flex flex-col items-center justify-center gap-1"
                >
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono text-zinc-400 group-hover:text-rose-500 transition-colors">1</div>
                    <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center mb-0.5">
                        <XIcon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        {labels["1"] || "Incorrect"}
                    </span>
                </button>

                {/* Option 2 (Correct) */}
                <button
                    onClick={() => onAction("2")}
                    disabled={disabled}
                    className="group relative h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all active:scale-[0.98] shadow-sm flex flex-col items-center justify-center gap-1"
                >
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono text-zinc-400 group-hover:text-emerald-500 transition-colors">2</div>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center mb-0.5">
                        <Check className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {labels["2"] || "Correct"}
                    </span>
                </button>
            </div>
        );
    }

    // ============================================
    // MODE: GRADE (FSRS 4 Options)
    // ============================================
    if (mode === "grade") {
        return (
            <div className="relative w-full">
                <div className="absolute -top-8 right-0 z-10">
                    <GradingHelp />
                </div>
                <div className={cn("grid grid-cols-4 gap-2 w-full h-20", className)}>
                    {/* 1: Again (Rose) */}
                    <GradeButton
                        shortcut="1"
                        label="忘了"
                        subLabel={gradeIntervals?.again}
                        color="rose"
                        onClick={() => onAction("1")}
                        disabled={disabled}
                    />
                    {/* 2: Hard (Amber) */}
                    <GradeButton
                        shortcut="2"
                        label="模糊"
                        subLabel={gradeIntervals?.hard}
                        color="amber"
                        onClick={() => onAction("2")}
                        disabled={disabled}
                    />
                    {/* 3: Good (Emerald) */}
                    <GradeButton
                        shortcut="3"
                        label="记得"
                        subLabel={gradeIntervals?.good}
                        color="emerald"
                        onClick={() => onAction("3")}
                        disabled={disabled}
                    />
                    {/* 4: Easy (Sky) */}
                    <GradeButton
                        shortcut="4"
                        label="秒记"
                        subLabel={gradeIntervals?.easy}
                        color="sky"
                        onClick={() => onAction("4")}
                        disabled={disabled}
                    />
                </div>
            </div>
        );
    }

    // ============================================
    // MODE: OPTIONS (Dynamic)
    // ============================================
    if (mode === "options") {
        const hasLabels = Object.keys(labels).length > 0;
        const keys = hasLabels ? Object.keys(labels).sort() : ["1", "2", "3", "4"];

        return (
            <div className={cn("grid grid-cols-2 gap-3 w-full", className)}>
                {keys.map((key, idx) => {
                    const letter = String.fromCharCode(65 + idx); // A, B, C, D
                    return (
                        <button
                            key={key}
                            onClick={() => onAction(key)}
                            disabled={disabled}
                            className="group relative p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-[0_4px_12px_-2px_rgba(99,102,241,0.2)] transition-all text-left active:scale-[0.98] flex flex-col gap-1"
                        >
                            <div className="flex items-center justify-between">
                                <span className="w-5 h-5 rounded flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    {letter}
                                </span>
                                <span className="text-[9px] font-mono text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-300">
                                    KEY: {key}
                                </span>
                            </div>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 line-clamp-1">
                                {labels[key] || `Option ${letter}`}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    }

    return null;
}

// Helper: Grade Button
function GradeButton({ shortcut, label, subLabel, color, onClick, disabled }: any) {
    const colorClasses = {
        rose: "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/40",
        amber: "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/40",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/40",
        sky: "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:border-sky-300 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/40",
    }[color as string];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "flex flex-col items-center justify-center h-full rounded-xl border transition-all active:scale-95 relative",
                colorClasses
            )}
        >
            <div className="absolute top-1 left-1 opacity-50 text-[8px] font-mono">{shortcut}</div>
            <span className="text-xs font-bold">{label}</span>
            <span className="text-[9px] font-mono opacity-60 mt-0.5">{subLabel}</span>
        </button>
    );
}

// Helper: Arrow Left Icon
function ArrowLeft({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </svg>
    )
}

// Helper: Space Icon
function SpaceIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="14" height="6" x="5" y="9" rx="2" />
        </svg>
    )
}
