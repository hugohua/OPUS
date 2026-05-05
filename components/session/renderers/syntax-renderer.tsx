/**
 * SyntaxRenderer - Focus Shell Implementation
 * 
 * Replaces the old UniversalCard implementation with the new Focus Shell & Control Deck.
 */

'use client';

import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefingPayload } from '@/types/briefing';
import { EditorialDrill } from '@/components/briefing/editorial-drill';
import { PhraseCard } from '@/components/briefing/phrase-card';
import { MagicWandDrawer } from '@/components/arena/magic-wand-drawer';
import { FocusShell, FocusShellVariant } from '@/components/drill/focus-shell';
import { ControlDeck, ControlDeckMode } from '@/components/drill/control-deck';
import { previewIntervals } from '@/lib/client/fsrs-preview';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

// --- Animations ---
// Using strict bezier curve for type safety
const STAGE_ANIMATION = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.02, y: -10 },
    transition: { duration: 0.4, ease: [0.42, 0, 0.58, 1] as [number, number, number, number] }
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
    variant?: FocusShellVariant; // [Fixed] Explicit type
    totalDrills?: number;
    rightAction?: React.ReactNode;
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
    variant = 'L0',
    totalDrills = 20, // Default batch size
    rightAction
}: SyntaxRendererProps) {
    const router = useRouter();
    const [isWandOpen, setIsWandOpen] = React.useState(false);

    // FSRS 预览间隔 (仅 Phrase/Grade 模式使用)
    const fsrsKey = drill.meta?.fsrsCard
        ? `${drill.meta.fsrsCard.stability}_${drill.meta.fsrsCard.difficulty}_${drill.meta.fsrsCard.reps}_${drill.meta.fsrsCard.state}`
        : 'new';
    const gradeIntervals = useMemo(() =>
        previewIntervals(drill.meta?.fsrsCard ?? undefined),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [fsrsKey]
    );

    // Data Extraction
    const textSegment = drill.segments.find(s => s.type === 'text');
    const interactSegment = drill.segments.find(s => s.type === 'interaction');

    // [Fixed] Safer typing with optional chain
    const task = interactSegment?.task;
    const interactionStyle = task?.style;
    const isArenaPart5 = drill.meta?.mode === 'ARENA_PART5';
    // ARENA_PART5 必须强制使用 Syntax 的选项风格
    const isPhraseMode = !isArenaPart5 && interactionStyle === 'bubble_select';

    // Helper: Progress Calculation
    const progress = Math.min(100, Math.max(0, ((index + 1) / totalDrills) * 100));

    // Helper: Logic Extractor (Reused logic)
    let explanationMarkdown = task?.explanation_markdown || "";
    if (!explanationMarkdown && task?.explanation) {
        const e = task.explanation;
        const traps = Array.isArray(e.trap_analysis) ? e.trap_analysis.join('\n') : "";
        explanationMarkdown = `## ${e.title || "Note"}\n\n${e.correct_logic || e.content || ""}\n\n${traps}`;
    }

    // Helper: Definition Extractor
    const getDefinition = () => {
        // [Fixed] Type safe access
        if (drill.meta?.definition_cn) {
            return drill.meta.definition_cn;
        }
        if (!interactSegment?.task) return "";

        const t = interactSegment.task;
        if (t.explanation?.definition_cn) return t.explanation.definition_cn;

        if (explanationMarkdown) {
            const line = explanationMarkdown.split('\n').find((l: string) => l.trim().length > 0 && !l.startsWith('##'));
            return line || "Definition not available";
        }
        return "Definition not available";
    };

    const wordDefinition = getDefinition();
    const posMatch = wordDefinition.match(/^\[(.*?)\]/);
    const cleanDefinition = posMatch ? wordDefinition.replace(/^\[.*?\]\s*/, "") : wordDefinition;

    // --- Handlers ---

    const handleDeckAction = (action: string) => {
        // PHRASE MODE (Flashcard Logic)
        if (isPhraseMode) {
            if (action === 'reveal') {
                setStatus('correct'); // Reveal state
            } else if (['1', '2', '3', '4'].includes(action)) {
                // Grade -> Complete
                const gradeMap: any = { '1': 1, '2': 2, '3': 3, '4': 4 };
                onComplete(gradeMap[action]);
            }
        }
        // SYNTAX MODE (Multiple Choice Logic)
        else {
            if (['1', '2', '3', '4'].includes(action)) {
                // Select Option Logic
                const options = task?.options || [];
                const idx = parseInt(action) - 1;

                // Safety check
                if (options && options[idx]) {
                    const optText = typeof options[idx] === 'string' ? options[idx] : options[idx].text;
                    onOptionSelect(optText);
                }
            } else if (action === 'continue') {
                // Move to next drill
                const isCorrect = selectedOption === task?.answer_key;
                onComplete(isCorrect);
            }
        }
    };

    // Determine Deck Mode
    let deckMode: ControlDeckMode = 'reveal';
    if (isPhraseMode) {
        deckMode = status === 'idle' ? 'reveal' : 'grade';
    } else {
        // Syntax Mode or Arena Part 5: Options (Idle) -> Continue (Result)
        deckMode = status === 'idle' ? 'options' : 'continue';
    }

    // Determine Shell Variant
    // Use prop or fallback to L0
    const shellVariant = variant || 'L0';
    const label = `${shellVariant} • ${isPhraseMode ? 'PHRASE' : drill.meta?.mode === 'ARENA_PART5' ? 'PART 5' : 'SYNTAX'}`;

    if (!textSegment || !interactSegment) {
        // 畸形 drill: 跳过，不记录 FSRS (用 onComplete(3) 不合理)
        return (
            <FocusShell variant={shellVariant} progress={progress} onExit={() => router.push('/dashboard')} rightAction={rightAction} footer={<div />}>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <p className="text-zinc-400 text-sm">内容加载异常，自动跳过...</p>
                    <button
                        className="text-xs text-zinc-500 underline"
                        onClick={onNext}
                    >
                        下一题
                    </button>
                </div>
            </FocusShell>
        );
    }

    // Prep Labels for Options Mode
    const optionLabels: any = {};
    if (deckMode === 'options' && task?.options) {
        task.options.forEach((opt: any, i: number) => {
            optionLabels[String(i + 1)] = typeof opt === 'string' ? opt : opt.text;
        });
    }

    // ARENA_PART5 specific data for Magic Wand
    const rationale = task?.explanation_markdown || "暂无详细解析";
    const sentence = textSegment.content_markdown || "";

    return (
        <>
            <FocusShell
                variant={shellVariant}
                progress={progress}
                onExit={() => router.push('/dashboard')}
                label={label}
                rightAction={rightAction}
                footer={
                    <ControlDeck
                        mode={deckMode}
                        onAction={handleDeckAction}
                        labels={deckMode === 'options' ? optionLabels : {}}
                        gradeIntervals={deckMode === 'grade' ? gradeIntervals : undefined}
                        // 如果是 Part 5 并且已经答完题，显示 AI 解析按钮
                        extraButton={isArenaPart5 && status !== 'idle' ? {
                            label: (
                                <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500" /> AI 解析
                                </span>
                            ) as any,
                            onClick: () => setIsWandOpen(true),
                        } : undefined}
                    />
                }
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        {...STAGE_ANIMATION}
                        className="w-full flex-1 flex flex-col items-center justify-center py-4"
                    >
                        {isPhraseMode ? (
                            <PhraseCard
                                phraseMarkdown={textSegment.content_markdown || ""}
                                translation={textSegment.translation_cn || ""}
                                wordDefinition={cleanDefinition}
                                status={status as any}
                                phonetic={textSegment.phonetic || ""}
                                partOfSpeech={posMatch ? posMatch[1] : ""}
                                targetWord={drill.meta?.target_word || ""}
                                etymology={drill.meta?.etymology}
                                userNote={drill.meta?.userNote} // [New] Feature A
                            />
                        ) : (
                            <EditorialDrill
                                content={textSegment.content_markdown || ""}
                                questionMarkdown={task?.question_markdown}
                                translation={textSegment.translation_cn}
                                explanation={explanationMarkdown}
                                answer={task?.answer_key || ""}
                                status={status}
                                selected={selectedOption}
                                userNote={drill.meta?.userNote} // [New] Feature A
                                suppressAutoPlay={isArenaPart5} // Arena 模式禁用自动播放
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </FocusShell>

            {isArenaPart5 && (
                <MagicWandDrawer
                    open={isWandOpen}
                    onOpenChange={setIsWandOpen}
                    rationale={rationale}
                    sentence={sentence}
                    targetWord={drill.meta?.target_word}
                    sentenceTranslation={textSegment.translation_cn}
                />
            )}
        </>
    );
}
