/**
 * AudioRenderer - AUDIO 模式渲染器
 * 
 * 功能：
 *   - 包装 AudioScriptDrill 组件
 *   - 处理音频播放控制
 *   - 处理评分回调
 */

'use client';

import React from 'react';
import { BriefingPayload } from '@/types/briefing';
import { AudioScriptDrill } from '@/components/drill/audio-script-drill';

export interface AudioRendererProps {
    drill: BriefingPayload;
    index: number;
    total: number;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onGrade: (grade: number) => void;
}

export function AudioRenderer({
    drill,
    index,
    total,
    isPlaying,
    onTogglePlay,
    onGrade,
}: AudioRendererProps) {
    return (
        <AudioScriptDrill
            drill={drill}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onGrade={onGrade}
            index={index + 1}
            total={total}
        />
    );
}
