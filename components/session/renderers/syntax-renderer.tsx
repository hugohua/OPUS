/**
 * SyntaxRenderer - SYNTAX/PHRASE 模式渲染器
 * 
 * 功能：
 *   - 渲染 EditorialDrill (SYNTAX) 或 PhraseCard (PHRASE)
 *   - 处理选项选择和状态显示
 *   - 统一的 Footer 交互
 */

'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefingPayload } from '@/types/briefing';
import { EditorialDrill } from '@/components/briefing/editorial-drill';
import { PhraseCard } from '@/components/briefing/phrase-card';
import { PhraseFooter } from '@/components/briefing/phrase-footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- 动画常量 ---
const CARD_ANIMATION = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.05, y: -10 },
    transition: { duration: 0.4 }
};

// --- Types ---
export interface SyntaxRendererProps {
    drill: BriefingPayload;
    index: number;
    status: 'idle' | 'correct' | 'wrong';
    selectedOption: string | null;
    onOptionSelect: (option: string) => void;
    onNext: () => void;
    onComplete: (result: boolean | number) => void;
    setStatus: (status: 'idle' | 'correct' | 'wrong') => void;
    variant?: 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'pink';
}

export function SyntaxRenderer({
    drill,
    index,
    status,
    selectedOption,
    onOptionSelect,
    onNext,
    onComplete,
    setStatus,
    variant = 'emerald',
}: SyntaxRendererProps) {
    const textSegment = drill.segments.find(s => s.type === 'text');
    const interactSegment = drill.segments.find(s => s.type === 'interaction');

    // Check if bubble_select style (Phrase Mode UI)
    const interactionStyle = (interactSegment?.task as any)?.style;
    const isPhraseMode = interactionStyle === 'bubble_select';

    // Handle explanation markdown
    const task = interactSegment?.task as any;
    let explanationMarkdown = task?.explanation_markdown || "";

    if (!explanationMarkdown && task?.explanation) {
        const e = task.explanation;
        const traps = Array.isArray(e.trap_analysis) ? e.trap_analysis.join('\n') : "";
        explanationMarkdown = `## ${e.title || "Note"}\n\n${e.correct_logic || e.content || ""}\n\n${traps}`;
    }

    // Extract definition
    const getDefinition = () => {
        if (drill.meta && (drill.meta as any).definition_cn) {
            return (drill.meta as any).definition_cn;
        }
        if (!interactSegment?.task) return "";
        const task = interactSegment.task as any;

        if (task.explanation && typeof task.explanation === 'object') {
            if (task.explanation.definition_cn) return task.explanation.definition_cn;
        }

        if (explanationMarkdown) {
            const lines = explanationMarkdown.split('\n');
            const cleanLines = lines.filter((l: string) =>
                l.trim().length > 0 &&
                !l.startsWith('##') &&
                !l.startsWith('**')
            );
            if (cleanLines.length > 0) return cleanLines[0];
        }

        return "Definition not available";
    };

    const wordDefinition = getDefinition();
    const posMatch = wordDefinition.match(/^\[(.*?)\]/);
    const partOfSpeech = posMatch ? posMatch[1] : "";
    const cleanDefinition = posMatch ? wordDefinition.replace(/^\[.*?\]\s*/, "") : wordDefinition;

    const handleNextDrill = () => {
        const answerKey = interactSegment?.task?.answer_key;
        if (!answerKey) return;
        const isCorrect = selectedOption === answerKey;
        onComplete(isCorrect);
    };

    if (!textSegment || !interactSegment) {
        return <div className="text-center text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="w-full">
            {isPhraseMode ? (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        {...CARD_ANIMATION}
                        className="w-full flex-1 flex flex-col items-center justify-center"
                    >
                        <PhraseCard
                            phraseMarkdown={textSegment.content_markdown || ""}
                            translation={(textSegment as any).translation_cn || ""}
                            wordDefinition={cleanDefinition}
                            status={status as any}
                            phonetic={textSegment.phonetic || explanationMarkdown?.match(/\[(.*?)\]/)?.[0] || ""}
                            partOfSpeech={partOfSpeech || ""}
                            targetWord={drill.meta?.target_word || ""}
                            etymology={(drill.meta as any).etymology}
                        />
                    </motion.div>
                </AnimatePresence>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        {...CARD_ANIMATION}
                        className="w-full flex-1 flex flex-col items-center justify-center"
                    >
                        <EditorialDrill
                            content={textSegment.content_markdown || ""}
                            questionMarkdown={(interactSegment.task as any)?.question_markdown}
                            translation={(textSegment as any).translation_cn}
                            explanation={explanationMarkdown}
                            answer={interactSegment.task?.answer_key || ""}
                            status={status}
                            selected={selectedOption}
                        />
                        {status === "idle" && (
                            <p className="mt-8 text-center font-mono text-[10px] text-zinc-500 uppercase tracking-widest animate-pulse">
                                Select the best option
                            </p>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}

// --- Footer Component ---
export interface SyntaxFooterProps {
    drill: BriefingPayload;
    status: 'idle' | 'correct' | 'wrong';
    onOptionSelect: (option: string) => void;
    onNext: () => void;
    onComplete: (result: boolean | number) => void;
    setStatus: (status: 'idle' | 'correct' | 'wrong') => void;
    selectedOption: string | null;
    variant?: 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'pink';
}

export function SyntaxFooter({
    drill,
    status,
    onOptionSelect,
    onNext,
    onComplete,
    setStatus,
    selectedOption,
    variant = 'emerald',
}: SyntaxFooterProps) {
    const interactSegment = drill.segments.find(s => s.type === 'interaction');
    const interactionStyle = (interactSegment?.task as any)?.style;
    const isPhraseMode = interactionStyle === 'bubble_select';

    const handleNextDrill = () => {
        const answerKey = interactSegment?.task?.answer_key;
        if (!answerKey) return;
        const isCorrect = selectedOption === answerKey;
        onComplete(isCorrect);
    };

    if (isPhraseMode) {
        return (
            <PhraseFooter
                status={status === 'idle' ? 'idle' : 'revealed'}
                onReveal={() => setStatus('correct')}
                onGrade={(g) => onComplete(g)}
            />
        );
    }

    return (
        <div className="w-full flex flex-col items-center justify-end">
            {status === "idle" && (
                <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6">
                    Select the best option
                </p>
            )}

            <div className="w-full grid grid-cols-2 gap-4 h-48">
                {status === "idle" ? (
                    interactSegment?.task?.options?.map((opt: any, idx: number) => {
                        const indexLabel = String.fromCharCode(65 + idx);
                        const optionText = typeof opt === 'string' ? opt : opt.text;
                        const optionKey = typeof opt === 'string' ? opt : opt.text;

                        return (
                            <button
                                key={idx}
                                onClick={() => onOptionSelect(optionKey)}
                                className="group relative h-full w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 active:scale-[0.96] transition-all flex flex-col items-center justify-center gap-3"
                            >
                                <span className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-xs font-mono text-zinc-400 flex items-center justify-center group-hover:border-emerald-200 group-hover:text-emerald-600 transition-colors">
                                    {indexLabel}
                                </span>
                                <span className="font-serif text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200">
                                    {optionText}
                                </span>
                            </button>
                        );
                    })
                ) : (
                    <div className="col-span-2 flex items-center justify-center h-full">
                        <Button
                            onClick={handleNextDrill}
                            className={cn(
                                "w-full h-20 text-xl font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-[2rem]",
                                variant === 'violet' ? "bg-violet-600 hover:bg-violet-500 shadow-violet-900/20" :
                                    variant === 'emerald' ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20" :
                                        variant === 'blue' ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20" :
                                            "bg-zinc-900 text-white hover:bg-zinc-800"
                            )}
                        >
                            Next Challenge <ArrowLeft className="w-6 h-6 ml-2 rotate-180" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
