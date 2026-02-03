"use client";

/**
 * Context Drill Card (L2)
 * 
 * [功能]
 * TOEIC Part 5/6/7 风格的语境填空练习。
 * 
 * [Layout]
 * - Zone A: 文章区域 (Email/Memo 格式，Serif 字体)
 * - Zone B: 4 选项 (全英文，slot_machine 交互)
 * - Socratic Tutor: 选错时弹出引导提示
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { UniversalCard } from "@/components/drill/universal-card";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X as XIcon, RotateCcw, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { BriefingPayload, BriefingSegment } from "@/types/briefing";
import { calculateImplicitGrade } from "@/lib/algorithm/grading"; // W4: Implicit grading

// ============================================
// Types
// ============================================

interface ContextDrillCardProps {
    /** Drill 内容 (从 BriefingPayload 提取) */
    drill: BriefingPayload;
    /** 当前进度 (0-100) */
    progress: number;
    /** 评分回调 */
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    /** 退出回调 */
    onExit: () => void;
}

type ContextState = "reading" | "answered" | "socratic";

// ============================================
// Component
// ============================================

export function ContextDrillCard({
    drill,
    progress,
    onGrade,
    onExit
}: ContextDrillCardProps) {
    const [state, setState] = useState<ContextState>("reading");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);

    // W2 Fix: 使用 useRef + useEffect 确保 drill 切换时 startTime 重置
    const startTimeRef = useRef<number>(Date.now());
    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [drill]);

    // 提取 Drill 数据
    const textSegment = drill.segments.find(s => s.type === "text");
    const interactionSegment = drill.segments.find(s => s.type === "interaction");

    const task = interactionSegment?.task;
    const options = task?.options || [];
    const correctAnswer = task?.answer_key || "";
    const explanation = task?.explanation_markdown || "";
    const socraticHint = task?.socraticHint || "";

    // 文章内容 (将 [___] 替换为下划线样式)
    const articleContent = useMemo(() => {
        const content = textSegment?.content_markdown || "";
        // 高亮空白处
        return content.replace(/\[___\]/g, "______");
    }, [textSegment]);

    // W3: Guard against empty options (LLM failure)
    if (options.length === 0) {
        return (
            <UniversalCard variant="amber" category="CONTEXT LAB" progress={progress} onExit={onExit} footer={<div />}>
                <div className="text-center text-zinc-500 py-8">
                    <p>No options available. Please try again.</p>
                </div>
            </UniversalCard>
        );
    }

    // W1 Fix: Removed unused isCorrect variable

    // 选择选项
    const handleSelect = (option: string) => {
        setSelectedOption(option);

        if (option === correctAnswer) {
            // 正确
            setState("answered");
            setShowAnswer(true);
        } else {
            // 错误 -> 显示 Socratic Tutor
            setState("socratic");
        }
    };

    // 重试 (从 Socratic 返回)
    const handleRetry = () => {
        setSelectedOption(null);
        setState("reading");
    };

    // 提交评分 (W4: Implicit Grading based on duration)
    const handleGrade = (inputGrade: 1 | 3) => {
        const duration = Date.now() - startTimeRef.current;
        const implicitGrade = calculateImplicitGrade(inputGrade, duration, false, 'CONTEXT');
        onGrade(implicitGrade as 1 | 2 | 3 | 4);
        // Reset for next card
        setState("reading");
        setSelectedOption(null);
        setShowAnswer(false);
    };

    // ============================================
    // ZONE A: Article Content
    // ============================================
    const ZoneA = (
        <div className="flex flex-col w-full">
            {/* 文章容器 (Serif 字体，模拟正式文档) */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
                {/* Format Badge */}
                <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-0.5 text-xs font-medium uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                        {drill.meta.format || "email"}
                    </span>
                    {drill.meta.target_word && (
                        <span className="text-xs text-zinc-400">
                            Target: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{drill.meta.target_word}</span>
                        </span>
                    )}
                </div>

                {/* Article Text (Serif) */}
                <div className="font-serif text-base leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                    {articleContent.split("______").map((part, idx, arr) => (
                        <React.Fragment key={idx}>
                            {part}
                            {idx < arr.length - 1 && (
                                <span className={cn(
                                    "inline-block min-w-[80px] mx-1 border-b-2 text-center font-sans font-medium",
                                    showAnswer
                                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                                        : "border-amber-400 text-amber-600 dark:text-amber-400"
                                )}>
                                    {showAnswer ? correctAnswer : "_____"}
                                </span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Answer Explanation (在答对后显示) */}
            <AnimatePresence>
                {showAnswer && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800"
                    >
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                            <Check className="w-4 h-4" />
                            <span className="font-semibold text-sm">Correct!</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {explanation}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Socratic Tutor (选错时显示) */}
            <AnimatePresence>
                {state === "socratic" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
                    >
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                            <Lightbulb className="w-4 h-4" />
                            <span className="font-semibold text-sm">Think Again...</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 italic leading-relaxed">
                            {socraticHint || "Look at the context clues around the blank. What word fits the meaning best?"}
                        </p>
                        <button
                            onClick={handleRetry}
                            className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Try Again
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    // ============================================
    // ZONE B: Options (Slot Machine Style)
    // ============================================
    const ZoneB = (
        <div className="w-full">
            {state !== "answered" ? (
                // READING/SOCRATIC: 显示选项
                <div className="grid grid-cols-2 gap-3">
                    {options.map((option, idx) => {
                        const isSelected = selectedOption === option;
                        const isWrong = isSelected && state === "socratic";

                        return (
                            <button
                                key={idx}
                                onClick={() => handleSelect(option)}
                                disabled={state === "socratic" && isSelected}
                                className={cn(
                                    "h-14 rounded-xl font-medium text-base transition-all flex items-center justify-center gap-2",
                                    "border-2",
                                    isWrong
                                        ? "border-rose-400 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 cursor-not-allowed"
                                        : isSelected
                                            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 active:scale-[0.98]"
                                )}
                            >
                                {isWrong && <XIcon className="w-4 h-4" />}
                                {option}
                            </button>
                        );
                    })}
                </div>
            ) : (
                // ANSWERED: 评分按钮
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleGrade(1)}
                        className="h-14 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-base hover:bg-rose-200 dark:hover:bg-rose-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5" />
                        <span>Hard</span>
                    </button>
                    <button
                        onClick={() => handleGrade(3)}
                        className="h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-base hover:bg-emerald-200 dark:hover:bg-emerald-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        <span>Got it</span>
                    </button>
                </div>
            )}
        </div>
    );

    // ============================================
    // Render
    // ============================================
    return (
        <UniversalCard
            variant="amber"
            category="CONTEXT LAB"
            progress={progress}
            onExit={onExit}
            footer={ZoneB}
        >
            {ZoneA}
        </UniversalCard>
    );
}
