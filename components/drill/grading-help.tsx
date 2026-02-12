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
                        请根据您对这个词的<strong>记忆程度</strong>进行打分。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        <div className="font-bold text-rose-600 text-xs w-12 pt-0.5">忘了</div>
                        <div className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                            <strong>完全不认识。</strong> 看到答案后才想起来，或者根本没印象。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                        <div className="font-bold text-amber-600 text-xs w-12 pt-0.5">模糊</div>
                        <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                            <strong>有点印象但不确定。</strong> 需要想一会儿，或者只记得大概意思。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                        <div className="font-bold text-emerald-600 text-xs w-12 pt-0.5">记得</div>
                        <div className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                            <strong>想起来了。</strong> 虽然稍有犹豫，但能回忆出正确含义。
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg border border-sky-100 dark:border-sky-900/30">
                        <div className="font-bold text-sky-600 text-xs w-12 pt-0.5">秒记</div>
                        <div className="text-xs text-sky-800 dark:text-sky-200 leading-relaxed">
                            <strong>瞬间反应。</strong> 一看就知道，完全不需要思考。
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30 text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed">
                    <strong>提示：</strong> 诚实打分效果最好。选 <strong>忘了</strong> 不丢人，它会帮你更快记住。
                </div>
            </DialogContent>
        </Dialog>
    );
}
