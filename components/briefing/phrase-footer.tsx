'use client';

import { Button } from '@/components/ui/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CircleX, Cloud, CircleCheck } from 'lucide-react';

const footerVariants = cva(
    "grid grid-cols-3 gap-3 w-full max-w-lg mx-auto",
    {
        variants: {
            mode: {
                default: "",
            }
        },
        defaultVariants: {
            mode: "default",
        }
    }
);

interface PhraseFooterProps {
    onGrade: (grade: number) => void;
    onReveal: () => void;
    status: 'idle' | 'revealed';
    disabled?: boolean;
}

export function PhraseFooter({ onGrade, onReveal, status, disabled }: PhraseFooterProps) {

    // Idle State: Reveal Button (Invisible or Minimal)
    if (status === 'idle') {
        return (
            <div className="w-full flex flex-col items-center justify-center pb-8 min-h-[120px]">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] animate-pulse mb-4">
                    Tap to reveal
                </p>
                <Button
                    onClick={onReveal}
                    className="w-full max-w-xs h-14 rounded-full text-base font-semibold tracking-wide shadow-lg active:scale-95 transition-all bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:scale-105 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                    Show Answer
                </Button>
            </div>
        );
    }

    // Revealed State: Grading Buttons
    // Using Glassmorphism cards as buttons
    return (
        <div className="w-full shrink-0 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
                    How well did you know this?
                </p>
            </div>

            <div className={footerVariants()}>
                {/* 1. Forgot (1) - Red/Rose */}
                <GradeButton
                    grade={1}
                    label="Forgot"
                    subLabel="1m"
                    icon={<CircleX className="w-5 h-5" strokeWidth={1.5} />}
                    colorClass="border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-500 dark:text-rose-400"
                    subColorClass="text-rose-300 dark:text-rose-500/70"
                    onClick={() => onGrade(1)}
                    disabled={disabled}
                />

                {/* 2. Hazy (2) - Amber */}
                <GradeButton
                    grade={2}
                    label="Hazy"
                    subLabel="10m"
                    icon={<Cloud className="w-5 h-5" strokeWidth={1.5} />}
                    colorClass="border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 text-amber-500 dark:text-amber-400"
                    subColorClass="text-amber-300 dark:text-amber-500/70"
                    onClick={() => onGrade(2)}
                    disabled={disabled}
                />

                {/* 3. Know (3) - Emerald */}
                <GradeButton
                    grade={3}
                    label="Know"
                    subLabel="4d"
                    icon={<CircleCheck className="w-5 h-5" strokeWidth={1.5} />}
                    colorClass="border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-500 dark:text-emerald-400"
                    subColorClass="text-emerald-300 dark:text-emerald-500/70"
                    onClick={() => onGrade(3)}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

// Sub-component for cleanliness
function GradeButton({ grade, label, subLabel, icon, colorClass, subColorClass, onClick, disabled }: any) {
    return (
        <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "group relative flex flex-col items-center justify-center h-28 rounded-2xl border backdrop-blur-sm transition-all shadow-sm bg-white dark:bg-zinc-900",
                colorClass,
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                {icon}
            </div>

            <span className="text-xs font-bold uppercase tracking-wider mt-1">
                {label}
            </span>

            <span className={cn(
                "absolute top-2 right-2 text-[9px] font-mono",
                subColorClass
            )}>
                {subLabel}
            </span>
        </motion.button>
    );
}
