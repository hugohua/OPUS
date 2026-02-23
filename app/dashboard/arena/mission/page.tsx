"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Search, Check, Sparkles, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MagicWandDrawer } from "@/components/arena/magic-wand-drawer";
import { ImmersiveHeader } from "@/components/ui/immersive-header";
import { motion, AnimatePresence } from "framer-motion";
import { generatePart6Session } from "@/actions/part6-queue";
import { BriefingPayload, InteractionSegment } from "@/types/briefing";

export default function MissionPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [payload, setPayload] = useState<BriefingPayload | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
    const [isWandOpen, setIsWandOpen] = useState(false);
    const [activeBlank, setActiveBlank] = useState<number | null>(null);
    const [dockHeight, setDockHeight] = useState(380);

    // Initial Load
    useEffect(() => {
        let mounted = true;
        const loadSession = async () => {
            try {
                const data = await generatePart6Session();
                if (mounted) {
                    setPayload(data);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load Part 6 session", error);
                if (mounted) setIsLoading(false);
            }
        };
        loadSession();
        return () => { mounted = false; }
    }, []);

    const handleSelect = (qIdx: number, optionId: string) => {
        if (selectedOptions[qIdx]) return; // Already answered
        setSelectedOptions(prev => ({ ...prev, [qIdx]: optionId }));
    };

    if (isLoading || !payload) {
        return (
            <div className="relative w-full h-[100dvh] max-w-md mx-auto bg-background flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground font-medium animate-pulse">Engaging Intelligence...</p>
            </div>
        );
    }

    // Interactive Passage Renderer
    const renderPassage = () => {
        if (!payload.passage_markdown) return null;

        const parts = payload.passage_markdown.split(/(\[__BLANK_\d__\])/g);

        return parts.map((part, index) => {
            const match = part.match(/\[__BLANK_(\d)__\]/);
            if (match) {
                const qIdx = parseInt(match[1], 10);
                const isAnswered = !!selectedOptions[qIdx];
                const isActive = activeBlank === qIdx;

                let text = "_______";
                let btnClasses = "mx-1 px-3 py-0.5 rounded-md font-mono text-sm border-b-2 font-bold transition-all ";

                if (isAnswered) {
                    const interaction = payload.segments[qIdx - 1] as InteractionSegment;
                    const selectedOpt = interaction.task?.options.find(o => (o.id || o.text) === selectedOptions[qIdx]);
                    text = selectedOpt?.text || "???";

                    if (selectedOpt?.is_correct) {
                        btnClasses += "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
                    } else {
                        btnClasses += "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 line-through decoration-rose-400";
                    }
                } else if (isActive) {
                    btnClasses += "bg-primary text-primary-foreground border-primary scale-110 shadow-sm";
                } else {
                    btnClasses += "bg-muted text-muted-foreground border-border hover:bg-muted/80";
                }

                return (
                    <button
                        key={index}
                        onClick={() => setActiveBlank(isActive ? null : qIdx)}
                        className={btnClasses}
                    >
                        {isAnswered ? text : 130 + qIdx}
                    </button>
                );
            }
            // Text rendering with line breaks
            return (
                <span key={index}>
                    {part.split('\n').map((line, i, arr) => (
                        <span key={i}>
                            {line}
                            {i !== arr.length - 1 && <br />}
                        </span>
                    ))}
                </span>
            );
        });
    };

    const currentInteraction = activeBlank
        ? (payload.segments[activeBlank - 1] as InteractionSegment)
        : null;

    const isCurrentRevealed = activeBlank ? !!selectedOptions[activeBlank] : false;

    return (
        <div className="relative w-full h-[100dvh] max-w-md mx-auto bg-background font-sans flex flex-col overflow-hidden sm:border-x sm:border-border">
            <ImmersiveHeader
                leftAction={
                    <Link href="/dashboard/arena" className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors active:scale-95">
                        <X className="w-5 h-5" />
                    </Link>
                }
                centerContent={
                    <div className="flex bg-primary/10 px-3 py-1.5 rounded-full items-center">
                        <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">Part 6</span>
                    </div>
                }
                rightAction={
                    <button className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors active:scale-95">
                        <Search className="w-5 h-5" />
                    </button>
                }
            />

            <main className="flex-1 overflow-y-auto relative z-10 no-scrollbar">
                <div className="p-5 font-serif text-foreground leading-relaxed text-[15px] space-y-4">
                    {renderPassage()}
                    <div className="h-24"></div>
                </div>
            </main>

            <motion.footer
                animate={{ height: (activeBlank !== null) ? dockHeight : "auto" }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="flex-none bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-15px_40px_rgba(0,0,0,0.1)] relative z-40 rounded-t-[20px] flex flex-col overflow-hidden w-full"
            >
                <div
                    className="w-full flex-none pt-3 pb-2 flex justify-center items-center cursor-ns-resize touch-none"
                    onPointerDown={(e) => {
                        if (activeBlank === null) return;
                        const startY = e.clientY;
                        const startHeight = dockHeight;
                        const onPointerMove = (moveEvent: PointerEvent) => {
                            const delta = startY - moveEvent.clientY;
                            let newHeight = startHeight + delta;
                            if (newHeight < 200) newHeight = 200;
                            if (newHeight > window.innerHeight * 0.8) newHeight = window.innerHeight * 0.8;
                            setDockHeight(newHeight);
                        };
                        const onPointerUp = () => {
                            document.removeEventListener("pointermove", onPointerMove);
                            document.removeEventListener("pointerup", onPointerUp);
                        };
                        document.addEventListener("pointermove", onPointerMove);
                        document.addEventListener("pointerup", onPointerUp);
                    }}
                >
                    <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
                </div>

                <div className={`flex-none px-4 flex items-center justify-between gap-3 border-border/50 ${activeBlank !== null ? 'pb-2 border-b' : 'pb-safe'}`}>
                    <button
                        onClick={() => setActiveBlank(Math.max(1, (activeBlank || 1) - 1))}
                        disabled={(activeBlank || 1) <= 1}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex-1 flex justify-center gap-3 py-1">
                        {[1, 2, 3, 4].map((qIdx) => {
                            const isAnswered = !!selectedOptions[qIdx];
                            const isActive = activeBlank === qIdx;
                            return (
                                <button
                                    key={qIdx}
                                    onClick={() => setActiveBlank(isActive ? null : qIdx)}
                                    className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center transition-all ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 scale-110'
                                        : isAnswered
                                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/50 hover:bg-emerald-500/20'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    {isAnswered && !isActive ? <Check className="w-4 h-4" /> : 130 + qIdx}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setActiveBlank(Math.min(4, (activeBlank || 1) + 1))}
                        disabled={(activeBlank || 1) >= 4}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <AnimatePresence>
                    {(activeBlank !== null && currentInteraction) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-6 pt-3 pb-2 flex-none">
                                <span className="text-xs font-mono font-bold text-primary tracking-wider">QUESTION {130 + activeBlank}</span>
                                {isCurrentRevealed && (
                                    <button
                                        onClick={() => setIsWandOpen(true)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> AI 解析
                                    </button>
                                )}
                            </div>

                            <div className="px-6 pb-2 space-y-2.5 overflow-y-auto no-scrollbar flex-1 pb-safe">
                                {currentInteraction.task?.options.map((opt: any, idx: number) => {
                                    const optionLabels = ['A', 'B', 'C', 'D'];
                                    const optionId = opt.id || optionLabels[idx];
                                    const isSelected = selectedOptions[activeBlank] === optionId;
                                    let stateClasses = "border-border bg-background hover:border-primary/50 text-muted-foreground";
                                    let icon = null;

                                    if (isSelected && !isCurrentRevealed) {
                                        stateClasses = "border-primary bg-primary/10 text-primary";
                                    }

                                    if (isCurrentRevealed) {
                                        if (opt.is_correct) {
                                            stateClasses = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]";
                                            icon = <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
                                        } else if (isSelected && !opt.is_correct) {
                                            stateClasses = "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400";
                                            icon = <X className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
                                        } else {
                                            stateClasses = "border-border bg-background dark:bg-zinc-950/50 text-muted-foreground dark:opacity-60 opacity-50";
                                        }
                                    }

                                    return (
                                        <button
                                            key={optionId}
                                            onClick={() => handleSelect(activeBlank, optionId)}
                                            disabled={isCurrentRevealed}
                                            className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 font-medium transition-all ${!isCurrentRevealed ? 'active:scale-[0.98]' : ''} ${stateClasses}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold ${isCurrentRevealed && opt.is_correct ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : isCurrentRevealed && isSelected && !opt.is_correct ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-muted shadow-sm text-muted-foreground'}`}>
                                                    {optionLabels[idx]}
                                                </span>
                                                <span className={`text-base text-left transition-all ${isCurrentRevealed && isSelected && !opt.is_correct ? 'line-through decoration-rose-300 dark:decoration-rose-700/50' : ''} ${!isCurrentRevealed ? 'text-foreground' : ''}`}>
                                                    {opt.text}
                                                </span>
                                            </div>
                                            {icon}
                                        </button>
                                    );
                                })}
                            </div>

                            {isCurrentRevealed && (
                                <div className="p-4 pt-2 pb-safe bg-card border-t border-border mt-auto flex-none">
                                    <button
                                        onClick={() => setActiveBlank(null)}
                                        className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors h-12 bg-foreground text-background hover:opacity-90 shadow-lg active:scale-[0.98]"
                                    >
                                        继续 <ArrowRight className="w-4 h-4 ml-2" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.footer>

            <MagicWandDrawer open={isWandOpen} onOpenChange={setIsWandOpen} />
        </div>
    );
}
