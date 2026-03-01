import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlobalHeaderProps {
    title: React.ReactNode;
    showStatusLight?: boolean;
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}

export function GlobalHeader({
    title,
    showStatusLight = false,
    leftSlot,
    rightSlot,
    className,
    children,
}: GlobalHeaderProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 px-5 flex flex-col gap-3 pointer-events-none",
                "bg-white/70 dark:bg-zinc-950/60 backdrop-blur-xl border-b border-zinc-200/50 dark:border-white/5",
                className
            )}
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 pointer-events-auto">
                    {leftSlot}
                    {typeof title === 'string' ? (
                        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50 tracking-tight">
                            {title}
                        </h1>
                    ) : (
                        title
                    )}
                    {showStatusLight && (
                        <span className="flex h-2 w-2 relative top-[-1px]">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    {rightSlot}
                </div>
            </div>

            {
                children && (
                    <div className="w-full pointer-events-auto">
                        {children}
                    </div>
                )
            }
        </header >
    );
}
