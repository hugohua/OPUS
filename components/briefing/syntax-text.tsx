'use client';

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

// --- CVA ---
const syntaxVariants = cva(
    "inline-block px-2 py-0.5 rounded-md mx-1 font-semibold border transition-all duration-300 shadow-sm",
    {
        variants: {
            type: {
                s: "bg-emerald-100 text-emerald-800 border-emerald-200/50 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 backdrop-blur-[2px]",
                v: "bg-rose-100 text-rose-800 border-rose-200/50 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 backdrop-blur-[2px]",
                o: "bg-sky-100 text-sky-800 border-sky-200/50 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30 backdrop-blur-[2px]",
                plain: "bg-transparent text-foreground border-transparent shadow-none",
            },
        },
        defaultVariants: {
            type: "plain",
        },
    }
);

interface SyntaxTextProps {
    content: string; // e.g. "<s>The manager</s> <v>signed</v> <o>the contract</o>."
    className?: string;
}

export function SyntaxText({ content, className }: SyntaxTextProps) {
    // Parsing Logic
    const segments = useMemo(() => {
        // Regex to match tags: <s>...</s> or <v>...</v> or <o>...</o>
        // Global match, capturing group for tag type and content
        // We split by tag regex to get parts
        // Regex: /<([svo])>(.*?)<\/\1>/g
        // But split logic is tricky with capture groups.
        // Let's use a simpler tokenization or regex replace.

        // We want to return an array of { text, type }.
        const regex = /<([svo])>(.*?)<\/\1>/gi;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Text before match
            if (match.index > lastIndex) {
                parts.push({
                    type: 'plain',
                    text: content.substring(lastIndex, match.index),
                });
            }
            // Matched tag
            parts.push({
                type: match[1].toLowerCase(), // s, v, o
                text: match[2],
            });
            lastIndex = regex.lastIndex;
        }
        // Remaining text
        if (lastIndex < content.length) {
            parts.push({
                type: 'plain',
                text: content.substring(lastIndex),
            });
        }

        return parts;
    }, [content]);

    return (
        <div className={cn("text-lg leading-relaxed", className)}>
            {segments.map((seg, i) => (
                <span
                    key={i}
                    className={cn(
                        syntaxVariants({ type: seg.type as any }),
                        seg.type === 'plain' ? "" : "shadow-sm"
                    )}
                >
                    {seg.text}
                </span>
            ))}
        </div>
    );
}
