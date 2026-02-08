"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BriefingPayload, TextSegment, InteractionSegment } from "@/types/briefing";
import paper from "canvas-confetti";
import { RotateCcw, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradingHelp } from "./grading-help";
import { boldToHtml } from "@/lib/utils/markdown";

interface AudioScriptDrillProps {
    drill: BriefingPayload;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onGrade: (grade: 1 | 2 | 3 | 4) => void;
    onNext?: () => void;
    index?: number;
    total?: number;
}

// 音频任务的类型定义
interface AudioTask {
    style: "swipe_card" | "bubble_select";
    question_markdown: string;
    options: (string | { id: string; text: string })[];
    answer_key: string;
    explanation?: {
        correct_logic?: string;
        definition_cn?: string;
        phonetic?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

// 类型守卫：安全提取 AudioTask
function isAudioTask(task: any): task is AudioTask {
    return task &&
        typeof task.answer_key === 'string' &&
        Array.isArray(task.options);
}

export function AudioScriptDrill({
    drill,
    isPlaying,
    onTogglePlay,
    onGrade,
    index = 1,
    total = 20
}: AudioScriptDrillProps) {
    const [status, setStatus] = useState<"listening" | "revealed">("listening");
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // 提取音频脚本（优先使用 audio_text，并移除 XML 标签）
    const textSegment = drill.segments.find((s): s is TextSegment => s.type === 'text');
    let rawScript = textSegment?.audio_text || textSegment?.content_markdown || "";
    const segment = drill.segments.find((s): s is InteractionSegment => s.type === 'interaction');

    // 安全提取任务数据
    const task = segment?.task && isAudioTask(segment.task) ? segment.task : null;
    if (!task) {
        console.error('AudioScriptDrill: 无效的任务数据');
        return <div className="p-4 text-red-500">数据加载失败</div>;
    }

    const answerKey = task.answer_key;
    const options = task.options || [];

    useEffect(() => {
        setStatus("listening");
        setSelectedOption(null);
    }, [drill]);

    // 统一的字符串标准化逻辑
    const normalize = (s: string) => s?.trim().toLowerCase() || "";

    const handleSelect = (option: string) => {
        if (status === "revealed") return;

        setSelectedOption(option);
        setStatus("revealed");

        const isCorrect = normalize(option) === normalize(answerKey);
        if (isCorrect) {
            paper({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    };

    const targetWord = drill.meta.target_word;
    const explanation = task?.explanation;

    // 提取音标和分析内容
    const phonetic = textSegment?.phonetic || explanation?.phonetic || "";
    const finalScript = rawScript.replace(/<[^>]+>/g, ''); // 移除 XML 标签
    const finalAnalysis = explanation?.correct_logic || "";

    // 获取定义的辅助函数
    const getDefinition = () => {
        return explanation?.definition_cn || (drill.meta as any).definition_cn || "";
    };

    return (
        <div className="relative w-full h-screen bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 flex flex-col items-center justify-between p-6">
            {/* 进度条 */}
            <div className="w-full max-w-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Audio Training</span>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{index}/{total}</span>
                </div>
                <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
                        style={{ width: `${(index / total) * 100}%` }}
                    />
                </div>
            </div>

            {/* 音频波形可视化 */}
            <div className="flex items-center gap-1 h-24 opacity-80 cursor-pointer" onClick={onTogglePlay}>
                <div className={cn("w-1.5 bg-cyan-600 dark:bg-cyan-500 rounded-full h-8", isPlaying && "animate-pulse")}></div>
                <div className={cn("w-1.5 bg-cyan-600 dark:bg-cyan-500 rounded-full h-16", isPlaying && "animate-pulse")}></div>
                <div className={cn("w-1.5 bg-cyan-600 dark:bg-cyan-500 rounded-full h-12", isPlaying && "animate-pulse")}></div>
                <div className={cn("w-1.5 bg-cyan-600 dark:bg-cyan-500 rounded-full h-20", isPlaying && "animate-pulse")}></div>
                <div className={cn("w-1.5 bg-cyan-600 dark:bg-cyan-500 rounded-full h-10", isPlaying && "animate-pulse")}></div>
            </div>

            {/* 问题提示 */}
            <div className="text-center mb-8">
                <p className="text-sm font-mono text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">What did you hear?</p>
            </div>

            {/* 选项网格 */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-3 mb-4">
                {options.map((opt, idx) => {
                    const optionText = typeof opt === 'string' ? opt : opt.text;
                    const optionKey = typeof opt === 'string' ? opt : opt.text;
                    const isSelected = selectedOption === optionKey;
                    const isCorrectOption = normalize(optionKey) === normalize(answerKey);
                    const showResult = status === "revealed";

                    return (
                        <button
                            key={idx}
                            onClick={() => handleSelect(optionKey)}
                            disabled={status === "revealed"}
                            className={cn(
                                "p-4 rounded-2xl border-2 transition-all text-lg font-medium",
                                !showResult && !isSelected && "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-cyan-400 dark:hover:border-cyan-500",
                                !showResult && isSelected && "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-500",
                                showResult && isSelected && isCorrectOption && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400",
                                showResult && isSelected && !isCorrectOption && "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-400",
                                showResult && !isSelected && isCorrectOption && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 opac ity-60"
                            )}
                        >
                            {optionText}
                        </button>
                    );
                })}
            </div>

            {/* 答案揭示层 */}
            {status === "revealed" && (
                <div className="absolute inset-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl flex flex-col pt-24 pb-12 px-6 animate-in fade-in duration-300">
                    <div className="flex-1 flex flex-col items-center text-center">
                        {/* 结果反馈徽章 */}
                        {(() => {
                            const isGivenUp = selectedOption === 'GIVE_UP';
                            const isCorrect = !isGivenUp && normalize(selectedOption || "") === normalize(answerKey || "");

                            return (
                                <div className={cn(
                                    "mb-6 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm flex items-center gap-2 animate-in zoom-in-50 duration-300",
                                    isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                        isGivenUp ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" :
                                            "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                )}>
                                    {isCorrect ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            <span>Correct</span>
                                        </>
                                    ) : isGivenUp ? (
                                        <>
                                            <HelpCircle className="w-4 h-4" />
                                            <span>Missed</span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-4 h-4" />
                                            <span>Incorrect</span>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex items-center gap-1 h-8 mb-8 opacity-50 cursor-pointer" onClick={onTogglePlay}>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-4", isPlaying && "animate-pulse")}></div>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-8", isPlaying && "animate-pulse")}></div>
                            <div className={cn("w-1 bg-cyan-600 dark:bg-cyan-500 rounded-full h-5", isPlaying && "animate-pulse")}></div>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-sans font-bold text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">{targetWord}</h1>
                        <p className="text-xl font-mono text-zinc-400 dark:text-zinc-500 mb-8">{phonetic || ""}</p>

                        <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 max-w-sm w-full text-left space-y-4">
                            {/* 脚本区域 */}
                            <div>
                                <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Script</span>
                                <div className="text-lg text-zinc-700 dark:text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: boldToHtml(finalScript, "text-cyan-600 dark:text-cyan-400 font-bold") }}
                                />
                            </div>

                            {/* 分析区域（如果存在）*/}
                            {finalAnalysis && (
                                <div className="pt-4 border-t border-zinc-200 dark:border-white/5">
                                    <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-500 uppercase tracking-wider block mb-1">Analysis</span>
                                    <div className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans"
                                        dangerouslySetInnerHTML={{ __html: boldToHtml(finalAnalysis, "text-cyan-600 dark:text-cyan-400 font-bold") }}
                                    />
                                </div>
                            )}

                            {/* 定义区域（如果存在）*/}
                            {getDefinition() && (
                                <div className="pt-4 border-t border-zinc-200 dark:border-white/5">
                                    <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Meaning</span>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {getDefinition()}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 评分按钮 - FSRS */}
                    <div className="w-full flex justify-between items-center px-1 mb-3 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest opacity-70">Rate Accuracy</span>
                        <GradingHelp />
                    </div>

                    <div className="grid grid-cols-4 gap-3 mt-auto">
                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(1)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-400 border-2">
                                <RotateCcw className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Again</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(2)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-2">
                                <span className="font-bold">2</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Hard</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(3)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-2">
                                <span className="font-bold">3</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Good</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button onClick={() => onGrade(4)} variant="outline" className="h-14 bg-zinc-50 dark:bg-zinc-900 border-cyan-200 dark:border-cyan-900/30 text-cyan-600 dark:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:text-cyan-700 dark:hover:text-cyan-400 border-2">
                                <span className="font-bold">4</span>
                            </Button>
                            <span className="text-[10px] text-center font-mono text-zinc-400 dark:text-zinc-500 uppercase">Easy</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
