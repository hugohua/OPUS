"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ImmersiveHeader } from "@/components/ui/immersive-header";

export type FocusShellVariant = "L0" | "L1" | "L2" | "default"; // L0=Amber, L1=Cyan, L2=Violet

interface FocusShellProps {
    variant?: FocusShellVariant;
    progress?: number;
    children: React.ReactNode;
    footer?: React.ReactNode;
    onExit?: () => void;
    // Optional: Label for the header badge (e.g., "L1 • LISTENING")
    label?: string;
    className?: string;
}

export function FocusShell({
    variant = "default",
    progress = 0,
    children,
    footer,
    onExit,
    label = "训练",
    className
}: FocusShellProps) {
    const shellRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 第一层：CSS class toggle（position:fixed + overflow:hidden）
        document.documentElement.classList.add('in-session');

        // 第二层：JS touchmove 拦截（iOS Safari 终极兜底）
        // 仅拦截 shell 容器自身的 touchmove，内部可滚动区域通过 data-scrollable 豁免
        const shell = shellRef.current;
        const preventTouchMove = (e: TouchEvent) => {
            // 检查触摸目标是否在可滚动的 main 区域内
            const target = e.target as HTMLElement;
            const scrollableParent = target.closest('[data-scrollable]');
            if (scrollableParent) {
                // 允许可滚动区域内部滚动
                return;
            }
            e.preventDefault();
        };

        shell?.addEventListener('touchmove', preventTouchMove, { passive: false });

        return () => {
            document.documentElement.classList.remove('in-session');
            shell?.removeEventListener('touchmove', preventTouchMove);
        };
    }, []);

    // Color System Mapping (Zinc as base, Variant as highlight)
    const variantStyles: Record<string, any> = {
        L0: {
            bar: "bg-amber-500",
            badge: "bg-white border-zinc-200 text-amber-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-amber-400",
            icon: "text-amber-500",
            selection: "selection:bg-amber-100 dark:selection:bg-amber-900/30"
        },
        L1: {
            bar: "bg-cyan-500",
            badge: "bg-white border-zinc-200 text-cyan-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-cyan-400",
            icon: "text-cyan-500",
            selection: "selection:bg-cyan-100 dark:selection:bg-cyan-900/30"
        },
        L2: {
            bar: "bg-indigo-600",
            badge: "bg-white border-zinc-200 text-indigo-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-indigo-400",
            icon: "text-indigo-500",
            selection: "selection:bg-indigo-100 dark:selection:bg-indigo-900/30"
        },
        default: {
            bar: "bg-zinc-500 dark:bg-zinc-400",
            badge: "bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400",
            icon: "text-zinc-500",
            selection: "selection:bg-zinc-200 dark:selection:bg-zinc-800"
        }
    };

    const styles = variantStyles[variant] || variantStyles.default;

    return (
        <div
            ref={shellRef}
            className={cn(
                // 使用 fixed + inset-0 替代 h-[100dvh]，避免 iOS Safari 地址栏动态调整引起布局抖动
                "fixed inset-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased flex flex-col overflow-hidden overscroll-none touch-none transition-colors duration-300 z-50",
                styles.selection,
                className
            )}
        >

            {/* 1. Standard Immersive Header (Variant B) */}
            <ImmersiveHeader
                className="bg-transparent dark:bg-transparent border-none"
                leftAction={
                    <button
                        onClick={onExit}
                        title="退出训练"
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all active:scale-95 active:bg-zinc-300/50"
                    >
                        <X className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                }
                centerContent={
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-all duration-300 backdrop-blur-md",
                        styles.badge
                    )}>
                        <div className={cn("w-2 h-2 rounded-full animate-pulse", styles.bar)} />
                        <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-90">
                            {label}
                        </span>
                    </div>
                }
            />

            {/* 2. Progress Line (Below Header) */}
            <div className="w-full px-6">
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800/50 rounded-full overflow-hidden mt-1">
                    <div
                        className={cn("h-full transition-all duration-700 ease-out rounded-full", styles.bar)}
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            </div>

            {/* 3. Stage (Main Content) — data-scrollable 允许内部滚动 */}
            <main
                data-scrollable
                className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-lg mx-auto overflow-y-auto scrollbar-hide overscroll-none touch-auto py-6"
            >
                {children}
            </main>

            {/* 4. Footer (Control Deck Slot) */}
            <footer className="flex-none w-full max-w-lg mx-auto px-6 pb-12 pt-2 z-20 min-h-[140px] flex flex-col justify-end">
                {footer}
            </footer>

        </div>
    );
}
