"use client";

import React, { useEffect } from "react";
import { useDrillStore } from "@/hooks/use-drill-store";
import { UniversalDrill } from "./universal-drill";
import { useSessionFlush } from "@/hooks/use-session-flush";
import { Loader2 } from "lucide-react";

interface InfiniteDrillFlowProps {
    userId: string;
}

export function InfiniteDrillFlow({ userId }: InfiniteDrillFlowProps) {
    const {
        drills,
        currentIndex,
        initSession,
        isLoading,
        error
    } = useDrillStore();

    // 挂载双重结算 Hook
    useSessionFlush(userId);

    // 初始化 Session
    useEffect(() => {
        initSession(userId);
    }, [userId]); // initSession is stable

    if (isLoading && drills.length === 0) {
        return (
            <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                <p className="text-zinc-500 text-sm font-medium">Preparing your session...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="text-center p-6">
                    <h3 className="text-lg font-bold text-rose-500 mb-2">Failed to load</h3>
                    <p className="text-zinc-500 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium active:scale-95 transition-transform"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const currentDrill = drills[currentIndex];

    if (!currentDrill) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-400">
                No active drills
            </div>
        );
    }

    return (
        <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
            {/* 
                使用 Key 强制重新渲染触发动画
                TODO: 后续优化为平滑的 Swiper 效果
            */}
            <div
                key={`${currentDrill.meta.vocabId}-${currentIndex}`}
                className="absolute inset-0 z-10 animate-in slide-in-from-bottom duration-500 fade-in ease-out fill-mode-forwards"
            >
                <UniversalDrill
                    drill={currentDrill}
                    userId={userId}
                    onExit={() => window.location.href = '/dashboard'}
                />
            </div>
        </div>
    );
}
