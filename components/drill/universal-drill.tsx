"use client";

import React, { useState } from "react";
import { BriefingPayload } from "@/types/briefing";
import { UniversalCard } from "./universal-card";
import { SyntaxText } from "@/components/briefing/syntax-text";
import { InteractionZone } from "@/components/briefing/interaction-zone";
import { useDrillStore } from "@/hooks/use-drill-store";
import { cn } from "@/lib/utils";

interface UniversalDrillProps {
    drill: BriefingPayload;
    userId: string;
    onExit: () => void;
}

export function UniversalDrill({ drill, userId, onExit }: UniversalDrillProps) {
    const { submitCurrent, isSubmitting } = useDrillStore();
    // Feedback 状态由 InteractionZone 内部和 onAnswer 回调控制
    const [showFeedback, setShowFeedback] = useState(false);
    const [startTime] = useState(Date.now());

    // 解析 Segment
    const textSegment = drill.segments.find(s => s.type === 'text');
    const taskSegment = drill.segments.find(s => s.type === 'interaction');

    // 颜色映射
    const variantMap = {
        S_V_O: "violet",
        VISUAL_TRAP: "rose",
        PART5_CLOZE: "emerald",
        AUDIO_RESPONSE: "amber",
        PARAPHRASE_ID: "blue"
    } as const;

    const variant = variantMap[drill.meta.drillType || 'S_V_O'] || 'violet';
    const categoryName = drill.meta.drillType?.replace(/_/g, ' ') || 'DRILL';

    // 提交处理
    const handleAnswer = (isCorrect: boolean) => {
        if (showFeedback || isSubmitting) return;
        setShowFeedback(true);
    };

    const handleComplete = async (isCorrect: boolean) => {
        const timeSpent = Date.now() - startTime;

        // 提交到 Store (乐观更新)
        // Store 会处理 API 调用和自动切题
        await submitCurrent(userId, isCorrect, timeSpent);
    };

    return (
        <UniversalCard
            variant={variant}
            category={categoryName}
            progress={0}
            onExit={onExit}
            footer={
                taskSegment?.task && (
                    <InteractionZone
                        task={taskSegment.task}
                        onAnswer={handleAnswer}
                        onComplete={handleComplete}
                    />
                )
            }
        >
            <div className="flex flex-col items-center gap-6">
                {/* 题干内容 */}
                {textSegment?.content_markdown && (
                    <div className="text-xl md:text-2xl font-serif leading-relaxed text-center">
                        <SyntaxText content={textSegment.content_markdown} />
                    </div>
                )}

                {/* 交互题干 (Question) */}
                {taskSegment?.task?.question_markdown && (
                    <div className="text-lg font-medium text-zinc-600 dark:text-zinc-400 text-center mt-4">
                        <SyntaxText content={taskSegment.task.question_markdown} />
                    </div>
                )}
            </div>
        </UniversalCard>
    );
}
