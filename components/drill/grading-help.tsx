"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

export function GradingHelp() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <HelpCircle className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm rounded-2xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-center mb-2">如何打分？</DialogTitle>
                    <DialogDescription className="text-center text-sm text-zinc-500 mb-4">
                        请根据您对目标词的<strong>听觉识别</strong>程度进行打分。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        <div className="font-bold text-rose-600 font-mono text-xs w-12 pt-0.5">AGAIN</div>
                        <div className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                            <strong>没听出来。</strong> 完全没听清，或者误听成了别的词。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div className="font-bold text-zinc-500 font-mono text-xs w-12 pt-0.5">HARD</div>
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            <strong>听清但迟疑。</strong> 需要思考或根据上下文推理，不是瞬间反应。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div className="font-bold text-zinc-500 font-mono text-xs w-12 pt-0.5">GOOD</div>
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            <strong>基本听懂。</strong> 听出来了，但在脑海中稍有犹豫。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-100 dark:border-cyan-900/30">
                        <div className="font-bold text-cyan-600 font-mono text-xs w-12 pt-0.5">EASY</div>
                        <div className="text-xs text-cyan-800 dark:text-cyan-200 leading-relaxed">
                            <strong>秒懂。</strong> 像听到 "Hello" 一样自然，完全不需要思考。
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30 text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>提示：</strong> 即使靠排除法猜对了选项，如果没听清目标单词，也请选 <strong>Hard</strong> 或 <strong>Again</strong>。
                </div>
            </DialogContent>
        </Dialog>
    );
}
