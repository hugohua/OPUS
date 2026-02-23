'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImmersiveHeader } from '@/components/ui/immersive-header';

interface HeaderProps {
    variant?: 'default' | 'drill' | 'reader';
    title?: string;
    subtitle?: string;
    progress?: number; // 0-100
    stepLabel?: string; // "05 / 20"
    rightAction?: React.ReactNode;
    onBack?: () => void;
    backPath?: string;
    className?: string; // 支持额外样式覆盖
}

export function Header({ variant = 'default', title, className, ...props }: HeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (props.backPath) {
            router.push(props.backPath);
        } else if (props.onBack) {
            props.onBack();
        } else {
            router.back();
        }
    };

    let centerContent = null;

    if (variant === 'default' && title) {
        centerContent = (
            <h1 className="text-sm font-bold tracking-wide text-zinc-900 dark:text-zinc-100 pointer-events-none">
                {title}
            </h1>
        );
    } else if (variant === 'drill' && props.stepLabel) {
        centerContent = (
            <div className="px-4 py-1.5 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center gap-2 pointer-events-none border border-transparent dark:border-white/5 shadow-sm">
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-300 tracking-widest">{props.stepLabel}</span>
            </div>
        );
    } else if (variant === 'reader') {
        centerContent = (
            <div className="flex flex-col items-center pointer-events-none">
                <h1 className="text-xs font-bold truncate max-w-[200px] text-zinc-900 dark:text-zinc-200">
                    {title}
                </h1>
                {props.subtitle && (
                    <p className="text-[9px] font-mono tracking-wide uppercase mt-0.5 text-emerald-600 dark:text-emerald-500">
                        {props.subtitle}
                    </p>
                )}
            </div>
        );
    }

    return (
        <ImmersiveHeader
            className={className}
            showDefaultBack={true}
            onBack={handleBack}
            centerContent={centerContent}
            rightAction={props.rightAction}
            progress={variant === 'drill' ? props.progress : undefined}
        />
    );
}
