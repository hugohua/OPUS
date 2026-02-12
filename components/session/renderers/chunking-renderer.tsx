/**
 * ChunkingRenderer - CHUNKING 模式渲染器
 * 
 * 功能：
 *   - 包装 ChunkingDrill 组件
 *   - 传递进度信息
 */

'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefingPayload } from '@/types/briefing';
import { ChunkingDrill } from '@/components/briefing/chunking-drill';

export interface ChunkingRendererProps {
    drill: BriefingPayload;
    index: number;
    total?: number;
    onComplete: (success: boolean) => void;
}

export function ChunkingRenderer({ drill, index, total = 20, onComplete }: ChunkingRendererProps) {
    // Extract chunking_drill segment or use entire drill
    const chunkingDrill = drill.segments.find((s: any) => s.type === 'chunking_drill') || drill;

    return (
        <div className="w-full h-full">
            <AnimatePresence mode="wait">
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full"
                >
                    <ChunkingDrill
                        drill={chunkingDrill as any}
                        index={index}
                        total={total}
                        onComplete={onComplete}
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
