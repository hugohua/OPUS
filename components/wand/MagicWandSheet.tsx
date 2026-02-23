"use client";

import React, { useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { MagicWandContent } from "./MagicWandContent";
import { toast } from "sonner";

interface MagicWandSheetProps {
    target: string | null; // Selected word or sentence
    type: "word" | "sentence";
    context?: string; // Context sentence for word mode
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Magic Wand Bottom Sheet
 * 
 * Functions:
 * - Manages Sheet visibility
 * - Triggers AI streaming analysis via useSSEStream (统一协议)
 * - Renders streaming markdown output via MagicWandContent
 */
export function MagicWandSheet({ target, type, context, isOpen, onOpenChange }: MagicWandSheetProps) {

    const { text: completion, isLoading, error, startStream } = useSSEStream({
        onError: (err) => {
            toast.error("Magic Wand failed", {
                description: err || "Something went wrong."
            });
        }
    });

    // Trigger analysis when sheet opens with valid target
    useEffect(() => {
        if (isOpen && target) {
            startStream("/api/wand/analyze", { text: target, type, context });
        }
    }, [isOpen, target]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[32px] px-0 pb-0 overflow-hidden bg-background border-t border-border flex flex-col">

                {/* Header Area */}
                <SheetHeader className="px-6 pr-10 pt-6 pb-2 border-b border-zinc-100 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10 space-y-0">
                    <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
                            <SheetTitle className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest">
                                AI 解析
                            </SheetTitle>
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 dark:text-zinc-600">
                            由 Qwen-Turbo 生成
                        </span>
                    </div>
                </SheetHeader>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
                    {target && (
                        <MagicWandContent
                            completion={completion}
                            isLoading={isLoading}
                            type={type}
                            target={target}
                        />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
