'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface HeaderProps {
    variant?: 'default' | 'drill' | 'reader';
    title?: string;
    subtitle?: string;
    progress?: number; // 0-100
    stepLabel?: string; // "05 / 20"
    rightAction?: React.ReactNode;
    onBack?: () => void;
    className?: string; // 支持额外样式覆盖
}

export function Header({ variant = 'default', title, className, ...props }: HeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (props.onBack) {
            props.onBack();
        } else {
            router.back();
        }
    };

    return (
        <header className={cn(
            // Layout
            "relative z-50 flex items-center justify-between h-14 px-4 transition-all w-full",
            // Theme: Light Mode
            "bg-zinc-50",
            // Theme: Dark Mode
            "dark:bg-zinc-950",
            // Effects
            className
        )}>

            {/* LEFT: Fixed Back Button */}
            <button
                onClick={handleBack}
                className={cn(
                    "flex items-center justify-center w-10 h-10 -ml-2 rounded-full transition-all active:scale-95",
                    "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50", // Adjusted hover for zinc-50 bg
                    "dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10"
                )}
                aria-label="Go back"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            {/* CENTER: Dynamic Content */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full max-w-[60%] pointer-events-none">

                {variant === 'default' && title && (
                    <h1 className="text-sm font-bold tracking-wide text-zinc-900 dark:text-zinc-200">
                        {title}
                    </h1>
                )}

                {variant === 'drill' && (
                    <div className="flex flex-col items-center justify-center w-full max-w-[120px] mx-auto">
                        <Progress
                            value={props.progress || 0}
                            className="h-1 w-full bg-zinc-200 dark:bg-zinc-800"
                            indicatorClassName="bg-violet-500 dark:shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                        />
                        {props.stepLabel && (
                            <span className="mt-1.5 font-mono text-[9px] tracking-widest uppercase text-zinc-500 dark:text-zinc-500">
                                {props.stepLabel}
                            </span>
                        )}
                    </div>
                )}

                {variant === 'reader' && (
                    <div className="flex flex-col items-center">
                        <h1 className="text-xs font-bold truncate max-w-[200px] text-zinc-900 dark:text-zinc-200">
                            {title}
                        </h1>
                        {props.subtitle && (
                            <p className="text-[9px] font-mono tracking-wide uppercase mt-0.5 text-emerald-600 dark:text-emerald-500">
                                {props.subtitle}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT: Actions Slot */}
            <div className="flex items-center -mr-2">
                {props.rightAction}
            </div>

        </header>
    );
}
