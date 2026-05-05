/**
 * ContextRenderer - CONTEXT 模式渲染器
 * 
 * 功能：
 *   - 包装 ContextDrillCard 组件
 *   - 处理评分回调
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BriefingPayload } from '@/types/briefing';
import { ContextDrillCard } from '@/components/drill/context-drill-card';

export interface ContextRendererProps {
    drill: BriefingPayload;
    progress: number;
    onGrade: (grade: boolean | number) => void;
    rightAction?: React.ReactNode;
}

export function ContextRenderer({ drill, progress, onGrade, rightAction }: ContextRendererProps) {
    const router = useRouter();

    return (
        <div className="bg-zinc-50 dark:bg-zinc-950 h-screen w-full relative">
            <ContextDrillCard
                drill={drill}
                progress={progress}
                onGrade={onGrade}
                onExit={() => router.push('/dashboard')}
                rightAction={rightAction}
            />
        </div>
    );
}
