import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface DrillCardPreviewProps {
    className?: string;
    question: string;
    options: (string | { text: string, id?: string })[];
    answer?: string;
    explanation?: string;
    model?: string;
    context?: string;
}

export function DrillCardPreview({
    className,
    question,
    options,
    answer,
    explanation,
    model,
    context
}: DrillCardPreviewProps) {
    return (
        <div className={cn("w-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl p-6 shadow-sm border border-border relative", className)}>
            <div className="absolute top-4 right-4 flex items-center gap-2">
                {context && (
                    <span className="text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1 rounded">
                        {context}
                    </span>
                )}
                <span className="text-[10px] font-mono text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1 rounded">
                    预览
                    {model && ` · ${model}`}
                </span>
            </div>

            <h3 className="font-serif text-xl leading-relaxed text-center mt-6 mb-8">
                {/* 简化渲染 markdown - 实际项目中可能需要 React Markdown */}
                {question || "无题目内容"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options?.map((opt, idx) => {
                    const text = typeof opt === 'string' ? opt : opt.text;
                    const isCorrect = answer && text === answer;

                    return (
                        <div
                            key={idx}
                            className={cn(
                                "p-3 rounded-xl border text-center text-sm transition-colors",
                                isCorrect
                                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 text-zinc-700 dark:text-zinc-300"
                            )}
                        >
                            {text}
                            {isCorrect && (
                                <span className="ml-2 text-[10px] text-emerald-500 uppercase tracking-wider">(Answer)</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {explanation && (
                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help w-fit">
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase">解释</p>
                                    <HelpCircle className="w-3 h-3 text-zinc-400" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>查看详细解释</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                        {explanation}
                    </p>
                </div>
            )}
        </div>
    );
}
