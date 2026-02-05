"use client";

import React, { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import { WandContent } from "./WandContent";
import { type WandWordOutput } from "@/lib/validations/weaver-wand-schemas";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MagicWandSheetProps {
    word: string | null; // null means closed
    contextId?: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Magic Wand Bottom Sheet (交互容器)
 * 
 * 功能:
 * - 监听 isOpen 变化，自动触发 API 查询
 * - 管理 Loading / Error 状态
 * - 渲染 WandContent
 */
export function MagicWandSheet({ word, contextId, isOpen, onOpenChange }: MagicWandSheetProps) {
    const [data, setData] = useState<WandWordOutput | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAILoading, setIsAILoading] = useState(false);

    useEffect(() => {
        if (isOpen && word) {
            fetchData(word);
        } else {
            // Reset on close
            // setData(null); // Optional: keep cache for faster reopen?
        }
    }, [isOpen, word]);

    async function fetchData(targetWord: string) {
        try {
            setIsLoading(true);
            setIsAILoading(true); // AI start loading implicitly

            // 1. Fetch Local Data (Cache-First)
            const params = new URLSearchParams({ word: targetWord });
            if (contextId) params.append("context_id", contextId);

            const res = await fetch(`/api/wand/word?${params.toString()}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error("Word not found");
                throw new Error("Failed to fetch word data");
            }

            const json = await res.json() as WandWordOutput;
            setData(json);
            setIsLoading(false);

            // 2. TODO: Handle SSE for AI Insight if enabled (Phase 3.5)
            // Currently API returns ai_insight as null, simulating async nature
            // Assume AI finishes loading later or immediately if cached?
            // For MVP, we stop loading after fetch as API doesn't confirm async trigger yet.
            // Or we simulate a delay for "demo" effect if ai_insight is null.

            if (json.ai_insight === null && contextId) {
                // Mock AI loading delay for demo
                setTimeout(() => {
                    setIsAILoading(false);
                }, 1500);
            } else {
                setIsAILoading(false); // Finished if data present or no context
            }

        } catch (error) {
            console.error("Magic Wand Error:", error);
            toast.error("Magic Wand broke", {
                description: "Could not retrieve spell info."
            });
            setIsLoading(false);
            setIsAILoading(false);
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[32px] px-0 pb-0 overflow-hidden bg-background border-t border-border">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-2 border-b border-border flex items-center justify-between bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
                        <SheetTitle className="text-2xl font-serif font-bold text-primary flex items-center gap-3">
                            {word}
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        </SheetTitle>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
                        {data && !isLoading ? (
                            <WandContent
                                data={data}
                                isAILoading={isAILoading}
                            />
                        ) : (
                            // Initial Loading State
                            isLoading && (
                                <div className="space-y-8 animate-pulse">
                                    <div className="h-32 bg-muted rounded-xl" />
                                    <div className="h-48 bg-muted rounded-xl" />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
