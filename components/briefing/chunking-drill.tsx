"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChunkingDrillOutput } from "@/lib/generators/l1/chunking";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    horizontalListSortingStrategy,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChunkingDrillProps {
    drill: ChunkingDrillOutput;
    onComplete: (success: boolean) => void;
}

// --- Sortable Chunk Component ---
function SortableChunk({ chunk, isXRayMode, isOverlay = false }: { chunk: any, isXRayMode: boolean, isOverlay?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: chunk.id, disabled: isXRayMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
        opacity: isDragging ? 0 : 1, // Hide original when dragging
    };

    // --- Visual Logic (Dual Theme) ---
    // Base Styles (Card)
    const baseLight = "bg-white border-zinc-200 text-zinc-900 shadow-sm";
    const baseDark = "dark:bg-zinc-900/60 dark:border-white/10 dark:text-zinc-100 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]";

    // Syntax Logic (S-V-O)
    const isCore = ['S', 'V', 'O'].includes(chunk.type);

    // X-Ray Active Styles
    let activeClass = "";
    if (isXRayMode) {
        if (chunk.type === 'S') {
            activeClass = "border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:shadow-[0_0_15px_rgba(16,185,129,0.1)]";
        } else if (chunk.type === 'V') {
            activeClass = "border-rose-500/50 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 dark:shadow-[0_0_15px_rgba(244,63,94,0.1)]";
        } else if (chunk.type === 'O') {
            activeClass = "border-sky-500/50 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 dark:shadow-[0_0_15px_rgba(14,165,233,0.1)]";
        } else {
            activeClass = "opacity-50 grayscale";
        }
    }

    // Default State & Hover
    const defaultClass = isOverlay
        ? "scale-105 shadow-2xl ring-1 ring-black/5 dark:ring-white/20 cursor-grabbing z-50" // Overlay
        : "hover:border-zinc-300 dark:hover:border-white/20 hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing";

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group touch-none outline-none">
            <div className={cn(
                "h-14 px-6 flex items-center justify-center rounded-xl border transition-all duration-300 select-none",
                baseLight, baseDark,
                isXRayMode ? activeClass : defaultClass
            )}>
                <span className={cn(
                    "text-lg tracking-wide",
                    isXRayMode && isCore ? "font-bold font-mono" : "font-serif italic"
                )}>
                    {chunk.text}
                </span>
            </div>

            {/* Syntax Badge (X-Ray Only) */}
            <AnimatePresence>
                {isXRayMode && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={cn(
                            "absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tighter uppercase border shadow-sm",
                            "bg-white dark:bg-zinc-950",
                            chunk.type === 'S' && "border-emerald-200 text-emerald-600 dark:border-emerald-500/50 dark:text-emerald-400",
                            chunk.type === 'V' && "border-rose-200 text-rose-600 dark:border-rose-500/50 dark:text-rose-400",
                            chunk.type === 'O' && "border-sky-200 text-sky-600 dark:border-sky-500/50 dark:text-sky-400",
                            !isCore && "border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                        )}
                    >
                        {chunk.type}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Main Component ---
export function ChunkingDrill({ drill, onComplete }: ChunkingDrillProps) {
    // Debug Log
    // console.log('[ChunkingDrill] Received drill:', drill);

    // State
    const [items, setItems] = useState(drill.chunks);
    // status: idle | success | error | gave_up
    const [status, setStatus] = useState<"idle" | "success" | "error" | "gave_up">("idle");
    const [isXRayMode, setIsXRayMode] = useState(false);
    const [activeId, setActiveId] = useState<number | null>(null);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Reset when drill changes
    useEffect(() => {
        // Randomize order initially
        const shuffled = [...drill.chunks].sort(() => Math.random() - 0.5);
        setItems(shuffled);
        setStatus("idle");
        setIsXRayMode(false);
    }, [drill]);

    const handleDragStart = (event: any) => {
        if (status === "success" || status === "gave_up") return;
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
        setActiveId(null);
        setStatus("idle"); // Reset error state on move
    };

    const handleCheck = () => {
        const currentOrder = items.map(c => c.id).join(",");
        const correctOrder = [...drill.chunks].sort((a, b) => a.id - b.id).map(c => c.id).join(",");

        if (currentOrder === correctOrder) {
            setStatus("success");
            setIsXRayMode(true); // Auto-enable X-Ray on success
        } else {
            setStatus("error");
            // Shake animation can be triggered here via state or ref
        }
    };

    const handleGiveUp = () => {
        // 1. Sort to correct order
        const correctOrder = [...drill.chunks].sort((a, b) => a.id - b.id);
        setItems(correctOrder);

        // 2. Set status to gave_up and show insight
        setStatus("gave_up");
        setIsXRayMode(true);
    };

    return (
        <div className="w-full h-full flex flex-col relative bg-background overflow-hidden transition-colors duration-300">

            {/* Top Toolbar (Floating Capsule) */}
            <div className="absolute top-6 left-6 z-50">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full border bg-white/80 border-zinc-200 text-zinc-500 backdrop-blur-md shadow-sm dark:bg-zinc-900/40 dark:border-white/10 dark:text-zinc-400">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">TARGET</span>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{drill.target_word}</span>
                </div>
            </div>

            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => (status === "success" || status === "gave_up") && setIsXRayMode(!isXRayMode)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 backdrop-blur-md shadow-sm",
                        isXRayMode
                            ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/30 dark:border-cyan-500/50 dark:text-cyan-400"
                            : "bg-white/80 border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900/40 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    )}
                    disabled={status === "idle" || status === "error"}
                >
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest">X-RAY</span>
                    <div className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        isXRayMode ? "bg-cyan-500 animate-pulse shadow-[0_0_8px_currentColor]" : "bg-zinc-300 dark:bg-zinc-600"
                    )} />
                </button>
            </div>

            {/* Main Sortable Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 w-full">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={items} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-6 max-w-4xl py-12 px-4">
                            {items.map((chunk, index) => (
                                <React.Fragment key={chunk.id}>
                                    <div className="relative">
                                        <SortableChunk chunk={chunk} isXRayMode={isXRayMode} />

                                        {/* X-Ray Connector */}
                                        {isXRayMode && index < items.length - 1 && drill.analysis && (() => {
                                            const nextChunk = items[index + 1];
                                            const link = drill.analysis.links.find(l => l.from_chunk_id === chunk.id && l.to_chunk_id === nextChunk.id);
                                            if (!link) return null;

                                            // Render connector
                                            return (
                                                <div className="absolute -right-5 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                                    <div className="w-6 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay adjustScale={true}>
                        {activeId ? (
                            <SortableChunk chunk={items.find(i => i.id === activeId)} isXRayMode={false} isOverlay />
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {!isXRayMode && (
                    <div className="mt-12 opacity-30 pointer-events-none animate-pulse">
                        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 tracking-[0.3em] uppercase">Drag to Reorder</span>
                    </div>
                )}
            </main>

            {/* Footer / Controls */}
            <footer className="w-full max-w-md mx-auto pb-safe pt-8 px-6 z-20">
                <AnimatePresence mode="wait">
                    {/* Insight Panel */}
                    {(status === "success" || status === "gave_up") && isXRayMode && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className={cn(
                                "rounded-2xl p-6 shadow-xl mb-8 relative overflow-hidden",
                                "bg-white border border-zinc-100", // Light
                                "dark:bg-zinc-900/80 dark:backdrop-blur-xl dark:border-white/10" // Dark
                            )}
                        >
                            <div className={cn(
                                "absolute left-0 top-0 bottom-0 w-1",
                                status === "gave_up" ? "bg-amber-500" : "bg-cyan-500"
                            )}></div>

                            <h3 className={cn(
                                "text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2",
                                status === "gave_up" ? "text-amber-600 dark:text-amber-400" : "text-cyan-600 dark:text-cyan-400"
                            )}>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    status === "gave_up" ? "bg-amber-500" : "bg-cyan-500"
                                )}></span>
                                {status === "gave_up" ? "Analysis" : "Boardroom Insight"}
                            </h3>

                            {drill.analysis && (
                                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-serif relative z-10 mb-4">
                                    {drill.analysis.business_insight}
                                </p>
                            )}

                            <div className="border-t border-zinc-100 dark:border-white/5 pt-4 mt-4">
                                <div className="flex flex-col gap-2">
                                    <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider">MEANING</div>
                                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{drill.translation_cn}</p>

                                    {drill.grammar_point && (
                                        <>
                                            <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider mt-2">GRAMMAR</div>
                                            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">{drill.grammar_point}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-3 pb-8">
                    {status === "idle" || status === "error" ? (
                        <>
                            {/* Give Up Button */}
                            <Button
                                onClick={handleGiveUp}
                                variant="outline"
                                className="flex-1 h-12 bg-transparent border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400"
                            >
                                <span className="text-xs font-bold tracking-widest uppercase">I Don't Know</span>
                            </Button>

                            {/* Check Button */}
                            <Button
                                onClick={handleCheck}
                                className={cn(
                                    "flex-[2] h-12 relative overflow-hidden transition-all",
                                    status === "error"
                                        ? "bg-red-500 hover:bg-red-600 text-white border-red-400"
                                        : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                                )}
                            >
                                <span className={cn(
                                    "relative z-10 text-xs font-bold tracking-widest uppercase",
                                    status === "error" && "animate-shake"
                                )}>
                                    {status === "error" ? "Try Again" : "Check Order"}
                                </span>
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={() => onComplete(status === "success")}
                            className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20"
                        >
                            <span className="text-xs font-bold tracking-widest uppercase">Next Puzzle</span>
                        </Button>
                    )}
                </div>
            </footer>
        </div>
    );
}
