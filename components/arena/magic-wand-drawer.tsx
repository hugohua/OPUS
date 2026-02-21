"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Sparkles, X } from "lucide-react";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export interface MagicWandDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rationale?: string;
    sentence?: string;
    targetWord?: string;
    sentenceTranslation?: string;
}

export function MagicWandDrawer({ open, onOpenChange, rationale, sentence, targetWord, sentenceTranslation }: MagicWandDrawerProps) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background rounded-t-2xl outline-none max-h-[85vh] border-border pb-safe">
                <VisuallyHidden.Root>
                    <DrawerTitle>AI 深度解析</DrawerTitle>
                </VisuallyHidden.Root>
                <div className="flex-none pt-3 pb-4 border-b border-border flex flex-col items-center sticky top-0 bg-background rounded-t-2xl z-20">
                    <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-3"></div>
                    <div className="w-full px-6 flex justify-between items-center">
                        <h3 className="text-base font-bold text-primary flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-500" />
                            AI 深度解析
                        </h3>
                        <button onClick={() => onOpenChange(false)} className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-3">
                            <span className="text-lg">🎯</span> 语境义与解析
                        </h4>
                        <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                            {rationale || "暂无解析。"}
                        </p>
                    </div>

                    {sentence && (
                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-primary mb-4">
                                <span className="text-lg">🦴</span> 句子原句
                            </h4>
                            <div className="bg-surface dark:bg-zinc-900 border border-border rounded-xl p-4 text-sm shadow-sm flex flex-col gap-2">
                                <div className="text-primary font-medium">{sentence}</div>
                                {sentenceTranslation && (
                                    <div className="text-muted-foreground pt-2 border-t border-border/50 text-xs">
                                        {sentenceTranslation}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-none p-6 pt-2 bg-background border-t border-border">
                    <button onClick={() => onOpenChange(false)} className="w-full inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-md active:scale-[0.98]">
                        继续刷题
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
