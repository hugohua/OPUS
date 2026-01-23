/**
 * Blitz Card Component
 * 功能：
 *   显示复习卡片 (Zone B)。
 *   支持 "Masked" (挖空) 和 "Revealed" (揭示) 两种状态。
 *   使用 framer-motion 进行平滑过渡。
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { BlitzItem } from '@/lib/validations/blitz';
import { PhraseHighlighter } from '@/components/drill/phrase-highlighter';

// CVA Definition for Card Container
const cardVariants = cva(
    "relative overflow-hidden rounded-xl border transition-all duration-300 flex flex-col items-center justify-center p-8 min-h-[400px] w-full max-w-md mx-auto select-none",
    {
        variants: {
            status: {
                masked: "bg-card border-border shadow-sm hover:shadow-md cursor-pointer", // Zone B (Interactive)
                revealed: "bg-card/50 border-primary/20 shadow-[0_0_30px_rgba(99,102,241,0.1)]", // Zone B (Passive)
            }
        },
        defaultVariants: {
            status: "masked"
        }
    }
);

interface BlitzCardProps extends VariantProps<typeof cardVariants> {
    item: BlitzItem;
    isRevealed: boolean;
    onReveal: () => void;
}

export function BlitzCard({ item, isRevealed, onReveal, status }: BlitzCardProps) {
    const computedStatus = isRevealed ? 'revealed' : 'masked';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={cn(cardVariants({ status: computedStatus }))}
            onClick={() => !isRevealed && onReveal()}
        >
            <div className="text-center space-y-8 w-full">
                {/* Context Sentence */}
                <div className="text-3xl md:text-4xl font-medium tracking-tight leading-snug text-foreground">
                    <AnimatePresence mode="wait">
                        {!isRevealed ? (
                            <motion.span
                                key="masked"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {item.context.maskedText}
                            </motion.span>
                        ) : (
                            <motion.span
                                key="revealed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <PhraseHighlighter
                                    text={item.context.text}
                                    highlights={[item.word]}
                                    className="text-foreground"
                                />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                {/* Translation (Only when revealed) */}
                <AnimatePresence>
                    {isRevealed && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                        >
                            <p className="text-lg text-muted-foreground/80 font-normal">
                                {item.context.translation}
                            </p>
                            {/* Target Word Info */}
                            <div className="pt-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    Target: {item.word}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hint Text (Only when masked) */}
                {!isRevealed && (
                    <div className="absolute bottom-6 left-0 w-full text-center">
                        <span className="text-xs text-muted-foreground/30 uppercase tracking-[0.2em] font-light animate-pulse">
                            Tap to Reveal
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
