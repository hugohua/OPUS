'use client';

/**
 * 通用复习模式选择器 (Drawer)
 * 
 * 功能：底部弹出抽屉，选择复习模式 + 选词数量
 * 复用：通过 scene prop 过滤该场景支持的模式（场景注册制）
 * 消费方：Drive / Blitz / Session（未来）
 */

import React from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer';
import {
    ReviewModeId,
    BatchSize,
    REVIEW_MODES,
    BATCH_SIZE_OPTIONS,
    SCENE_MODES,
    type SceneId,
} from '@/lib/constants/review-modes';
import { cn } from '@/lib/utils';
import {
    Layers, Target, Wrench, Headphones, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

// ------------------------------------------------------------------
// Icon 映射 (Lucide icon name → Component)
// ------------------------------------------------------------------
const ICON_MAP: Record<string, LucideIcon> = {
    Layers,
    Target,
    Wrench,
    Headphones,
    Sparkles,
};

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------
export interface ReviewModePickerProps {
    /** 当前业务场景 */
    scene: SceneId;
    /** 当前选中的模式 */
    currentMode: ReviewModeId;
    /** 当前选中的数量 */
    currentBatchSize: BatchSize;
    /** 选择回调 */
    onSelect: (mode: ReviewModeId, batchSize: BatchSize) => void;
    /** 控制打开状态 */
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
export function ReviewModePicker({
    scene,
    currentMode,
    currentBatchSize,
    onSelect,
    open,
    onOpenChange,
}: ReviewModePickerProps) {
    const [selectedMode, setSelectedMode] = React.useState<ReviewModeId>(currentMode);
    const [selectedBatch, setSelectedBatch] = React.useState<BatchSize>(currentBatchSize);

    // 同步外部状态变更
    React.useEffect(() => {
        setSelectedMode(currentMode);
        setSelectedBatch(currentBatchSize);
    }, [currentMode, currentBatchSize]);

    // 获取该场景支持的模式
    const availableModes = SCENE_MODES[scene] || [];

    const handleConfirm = () => {
        onSelect(selectedMode, selectedBatch);
        onOpenChange(false);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-md pb-8">
                    <DrawerHeader>
                        <DrawerTitle className="text-center">选择复习模式</DrawerTitle>
                        <DrawerDescription className="text-center">
                            切换模式或数量后，将重新生成播放列表
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-4 space-y-6">
                        {/* 模式卡片列表 */}
                        <div className="space-y-2">
                            {availableModes.map((modeId) => {
                                const config = REVIEW_MODES[modeId];
                                const Icon = ICON_MAP[config.icon] || Layers;
                                const isSelected = selectedMode === modeId;

                                return (
                                    <button
                                        key={modeId}
                                        onClick={() => setSelectedMode(modeId)}
                                        className={cn(
                                            'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                                            'hover:bg-muted/50 active:scale-[0.98]',
                                            isSelected
                                                ? 'border-brand-core bg-brand-core/5 shadow-sm'
                                                : 'border-border'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                                            isSelected
                                                ? 'bg-brand-core text-white'
                                                : 'bg-muted text-muted-foreground'
                                        )}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                'text-sm font-semibold',
                                                isSelected && 'text-brand-core'
                                            )}>
                                                {config.label}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {config.desc}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-brand-core shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 分割线 */}
                        <div className="h-px bg-border" />

                        {/* 选词数量 Segmented Control */}
                        <div>
                            <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                                选词数量
                            </div>
                            <div className="flex gap-2">
                                {BATCH_SIZE_OPTIONS.map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => setSelectedBatch(size)}
                                        className={cn(
                                            'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                                            'border active:scale-95',
                                            selectedBatch === size
                                                ? 'border-brand-core bg-brand-core text-white shadow-sm'
                                                : 'border-border text-muted-foreground hover:bg-muted/50'
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 确认按钮 */}
                        <Button
                            variant="default"
                            onClick={handleConfirm}
                            className="w-full"
                        >
                            应用
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
