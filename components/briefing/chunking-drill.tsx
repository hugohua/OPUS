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
    onComplete: () => void;
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
    const [items, setItems] = useState(() => {
        if (!drill?.chunks) return [];
        return [...drill.chunks].sort(() => Math.random() - 0.5);
    });
    const [isXRayMode, setIsXRayMode] = useState(false);
    const [status, setStatus] = useState<"sorting" | "success" | "error">("sorting");
    const [activeId, setActiveId] = useState<number | null>(null);

    // Sync state when drill changes
    useEffect(() => {
        if (drill?.chunks) {
            setItems([...drill.chunks].sort(() => Math.random() - 0.5));
            setIsXRayMode(false);
            setStatus("sorting");
        }
    }, [drill?.full_sentence]);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            if (status === 'error') setStatus('sorting');
        }
    };

    const handleCheck = () => {
        const currentIds = items.map(i => i.id);
        const correctIds = [...drill.chunks].sort((a, b) => a.id - b.id).map(i => i.id);
        const isCorrect = currentIds.every((id, index) => id === correctIds[index]);

        if (isCorrect) {
            setStatus("success");
            setIsXRayMode(true);
        } else {
            setStatus("error");
            setTimeout(() => setStatus("sorting"), 1000);
        }
    };

    return (
        <div className="w-full h-full flex flex-col relative bg-background overflow-hidden transition-colors duration-300">

            {/* Top Toolbar (Floating Capsule) */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => status === "success" && setIsXRayMode(!isXRayMode)}
                    className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 backdrop-blur-md shadow-sm",
                        isXRayMode
                            ? "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/30 dark:border-cyan-500/50 dark:text-cyan-400"
                            : "bg-white/80 border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900/40 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    )}
                    disabled={status !== "success"}
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
                    {/* Insight Panel (Dual Theme) */}
                    {isXRayMode && drill.analysis && (
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
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>
                            <h3 className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                                Boardroom Insight
                            </h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-serif relative z-10">
                                {drill.analysis.business_insight}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-center pb-8">
                    {status === 'success' ? (
                        <Button
                            onClick={onComplete}
                            className="w-full h-14 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 font-bold tracking-widest shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            NEXT PUZZLE
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCheck}
                            variant="secondary"
                            className={cn(
                                "w-full h-14 rounded-full font-bold tracking-widest transition-all text-sm border",
                                status === 'error'
                                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-500/30 shake"
                                    : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                            )}
                        >
                            {status === 'error' ? 'TRY AGAIN' : 'CHECK ORDER'}
                        </Button>
                    )}
                </div>
            </footer>
        </div>
    );
}
