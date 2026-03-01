import React, { useMemo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { FileText, Bone } from "lucide-react";

interface WandStreamProps {
    completion: string;
    isLoading: boolean;
    type: "word" | "sentence";
    target: string;
}

export function WandStreamView({ completion, isLoading, type, target }: WandStreamProps) {
    const sections = useMemo(() => {
        if (!completion) return [];
        const parts = completion.split(/###/g).filter(Boolean);
        return parts.map(part => {
            const lines = part.trim().split('\n');
            const titleLine = lines[0];
            const content = lines.slice(1).join('\n').trim();

            // Extract Emoji (We no longer use emojis directly, but parse the text title instead)
            // Wait, we still get emojis from LLM output potentially, but we want to render them correctly or map them.
            // Since this is just a fallback view for wand (MagicWandContent is the main one), we'll do best effort map or pass through string
            let icon: string | ReactNode = type === "word" ? <FileText className="w-3.5 h-3.5" /> : <Bone className="w-3.5 h-3.5" />;

            const emojiMatch = titleLine.match(/^([\p{Emoji}]+)\s*(.+)/u);
            if (emojiMatch) {
                // If the LLM generates an emoji, we let it pass through since it's dynamic output
                // But we default to Lucide if none generated
                icon = emojiMatch[1];
            }

            const title = emojiMatch ? emojiMatch[2] : titleLine;

            return { icon, title, content };
        });
    }, [completion, type]);

    const renderText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <span key={idx} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1 rounded font-bold border-b border-indigo-100 dark:border-indigo-800/50 mx-0.5 box-decoration-clone">
                        {part.slice(2, -2)}
                    </span>
                );
            }
            return <span key={idx}>{part}</span>;
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-baseline gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <h1 className="font-serif text-3xl font-bold text-slate-900 dark:text-zinc-100 break-words leading-tight">
                    {target.length > 50 ? "Sentence Analysis" : target}
                </h1>
                {type === "word" && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono font-bold text-slate-500 uppercase">WORD</span>
                )}
            </div>

            {/* Sections */}
            <div className="space-y-6">
                {sections.map((section, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs text-center">
                                {section.icon}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pt-0.5">
                                {section.title}
                            </span>
                        </div>
                        <div className="text-base text-slate-700 dark:text-zinc-300 leading-relaxed font-serif">
                            {section.content.split('\n').map((line, lIdx) => (
                                <p key={lIdx} className={cn("mb-2", line.trim().startsWith('-') && "pl-4")}>
                                    {renderText(line)}
                                </p>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Loading / Cursor */}
            {isLoading && (
                <div className="py-4 flex flex-col gap-4 opacity-50 animate-pulse">
                    {sections.length === 0 && (
                        <>
                            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4" />
                            <div className="space-y-2">
                                <div className="h-4 bg-slate-100 dark:bg-zinc-800/50 rounded w-full" />
                                <div className="h-4 bg-slate-100 dark:bg-zinc-800/50 rounded w-5/6" />
                            </div>
                        </>
                    )}
                    <div className="w-1.5 h-4 bg-indigo-500 animate-pulse" />
                </div>
            )}
        </div>
    );
}
