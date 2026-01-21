import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ============================================
// Types & Interfaces
// ============================================

const segmentVariants = cva('inline-block transition-colors duration-300 rounded-sm px-0.5 -mx-0.5', {
    variants: {
        type: {
            text: 'text-foreground',
            s: 'underline decoration-2 underline-offset-4 decoration-green-500/50 hover:decoration-green-500', // Subject
            v: 'font-bold text-red-600 dark:text-red-400 mx-[3px]', // Verb
            o: 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-100 font-medium', // Object - Boosted contrast
            mark: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-900 dark:text-yellow-100 font-medium', // Focus - Boosted contrast
        },
    },
    defaultVariants: {
        type: 'text',
    },
});

type SegmentType = VariantProps<typeof segmentVariants>['type'];

interface SyntaxTextProps {
    /** The raw markdown string containing XML tags like <s>...</s> */
    content: string;
    className?: string;
}

// ============================================
// Helpers
// ============================================

/**
 * Regex to capture XML-like tags: 
 * <s>content</s>, <v>content</v>, <o>content</o>, <mark>content</mark>
 * 
 * Captures:
 * 1. The full tag (e.g. "<s>text</s>")
 * 2. The tag name (e.g. "s")
 * 3. The inner text (e.g. "text")
 */
const TAG_REGEX = /<([svo]|mark)>(.*?)<\/\1>/g;

// ============================================
// Component
// ============================================

export function SyntaxText({ content, className }: SyntaxTextProps) {
    if (!content) return null;

    // Split content by tags, preserving the separators to process them
    // We can't just use split because we want to map them to CVA variants.
    // Instead, let's use a matchAll approach or a sophisticated split.

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex state since it's global
    TAG_REGEX.lastIndex = 0;

    while ((match = TAG_REGEX.exec(content)) !== null) {
        const [fullMatch, tagName, innerText] = match;
        const startIndex = match.index;

        // 1. Push preceding plain text
        if (startIndex > lastIndex) {
            const text = content.slice(lastIndex, startIndex);
            parts.push(
                <span key={`text-${lastIndex}`} className={segmentVariants({ type: 'text' })}>
                    {text}
                </span>
            );
        }

        // 2. Push styled segment
        // tagName is guaranteed to be 's', 'v', 'o', or 'mark' by the regex
        const type = tagName as SegmentType;
        parts.push(
            <span key={`tag-${startIndex}`} className={cn(segmentVariants({ type }))}>
                {innerText}
            </span>
        );

        lastIndex = startIndex + fullMatch.length;
    }

    // 3. Push remaining plain text
    if (lastIndex < content.length) {
        const text = content.slice(lastIndex);
        parts.push(
            <span key={`text-${lastIndex}`} className={segmentVariants({ type: 'text' })}>
                {text}
            </span>
        );
    }

    return (
        <p className={cn("text-lg md:text-xl leading-relaxed tracking-wide text-foreground", className)}>
            {parts}
        </p>
    );
}
