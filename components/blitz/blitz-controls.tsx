/**
 * Blitz Controls Component
 * 功能：
 *   Zone C 交互区域 (Bottom)。
 *   提供 "Forgot" (1) 和 "Got it" (3) 按钮。
 */
'use client';

import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';

interface BlitzControlsProps {
    isRevealed: boolean;
    onRate: (rating: 1 | 3) => void;
    onReveal: () => void;
}

export function BlitzControls({ isRevealed, onRate, onReveal }: BlitzControlsProps) {
    if (!isRevealed) {
        // Invisible overlay handled by Card click, but here we can add a visual hint button if needed.
        // For minimalist design, we trust the Card's "Tap to Reveal" hint.
        // Adding a clear button for accessibility/clarity.
        return (
            <div className="fixed bottom-10 left-0 w-full px-6 flex justify-center pointer-events-none">
                {/* Visual Hint Button (Optional, can be hidden if card hint is enough) */}
                {/* <Button 
                    variant="ghost" 
                    className="pointer-events-auto opacity-50 hover:opacity-100 transition-opacity"
                    onClick={onReveal}
                 >
                    Tap to Reveal
                 </Button> */}
            </div>
        );
    }

    return (
        <div className="fixed bottom-10 left-0 w-full px-6 max-w-md mx-auto left-0 right-0 flex gap-4 justify-between items-center z-50">
            {/* Forgot (Rating 1) */}
            <Button
                variant="outline"
                size="lg"
                className="flex-1 h-14 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors text-lg font-medium"
                onClick={() => onRate(1)}
            >
                <X className="w-5 h-5 mr-2" />
                Forgot
                <span className="ml-2 text-xs opacity-50 font-mono">[1]</span>
            </Button>

            {/* Got It (Rating 3) */}
            <Button
                variant="default"
                size="lg"
                className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-lg font-medium shadow-lg shadow-primary/20"
                onClick={() => onRate(3)}
            >
                <Check className="w-5 h-5 mr-2" />
                Got it
                <span className="ml-2 text-xs opacity-50 font-mono">[2]</span>
            </Button>
        </div>
    );
}
