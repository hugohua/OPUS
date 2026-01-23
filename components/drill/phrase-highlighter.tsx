'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PhraseHighlighterProps {
    text: string;
    highlights: string[];
    className?: string;
}

export function PhraseHighlighter({ text, highlights, className }: PhraseHighlighterProps) {
    const parts = useMemo(() => {
        if (!highlights || highlights.length === 0) {
            return [{ text, isHighlight: false }];
        }

        // Escape regex special characters
        const escaped = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        // Sort by length desc to match longest first (e.g. "signing" before "sign")
        escaped.sort((a, b) => b.length - a.length);

        const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

        // Split
        const split = text.split(pattern);
        // Find matches
        // Note: split with capturing group includes the separator in the result array.

        return split.map(part => {
            // Check if this part matches any highlight (case insensitive)
            const isHighlight = highlights.some(h => h.toLowerCase() === part.toLowerCase());
            return { text: part, isHighlight };
        });

    }, [text, highlights]);

    return (
        <span className={cn("inline", className)}>
            {parts.map((p, i) => (
                <span
                    key={i}
                    className={cn(
                        p.isHighlight
                            ? "text-primary font-bold decoration-primary/30 underline decoration-2 underline-offset-2"
                            : "text-muted-foreground font-normal"
                    )}
                >
                    {p.text}
                </span>
            ))}
        </span>
    );
}
