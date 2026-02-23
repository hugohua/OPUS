'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ImmersiveHeaderProps {
    leftAction?: React.ReactNode;
    centerContent?: React.ReactNode;
    rightAction?: React.ReactNode;
    progress?: number; // 0-100
    onBack?: () => void;
    backPath?: string;
    className?: string;
    showDefaultBack?: boolean;
}

export function ImmersiveHeader({
    leftAction,
    centerContent,
    rightAction,
    progress,
    onBack,
    backPath,
    className,
    showDefaultBack = false,
}: ImmersiveHeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (backPath) {
            router.push(backPath);
        } else if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    return (
        <header
            className={cn(
                "sticky top-0 z-50 pt-[calc(env(safe-area-inset-top)+1rem)] pb-2 px-5 flex flex-col gap-3",
                "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-transparent dark:border-white/10",
                className
            )}
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex-none flex items-center justify-start min-w-[40px]">
                    {leftAction ? leftAction : showDefaultBack ? (
                        <button
                            onClick={handleBack}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    ) : null}
                </div>

                <div className="flex-1 flex justify-center">
                    {centerContent}
                </div>

                <div className="flex-none flex justify-end gap-2 min-w-[40px]">
                    {rightAction}
                </div>
            </div>

            {progress !== undefined && (
                <div className="w-full h-1 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                </div>
            )}
        </header>
    );
}
