/**
 * 卡片堆栈组件
 * 
 * 功能：
 *   可滑动的卡片堆栈，支持左右滑动投票。
 *   支持 onNeedMore 回调实现无限滚动预加载。
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { WordCard } from './word-card';
import { WordAsset } from '@/types/word';
import { Button } from '@/components/ui/button';
import { X, Check, RefreshCw } from 'lucide-react';

interface CardStackProps {
    items: WordAsset[];
    onNeedMore?: () => void;
    onCardComplete?: () => void;
}

const PRELOAD_THRESHOLD = 5; // 剩余 ≤5 张时预加载

export function CardStack({ items, onNeedMore, onCardComplete }: CardStackProps) {
    const [index, setIndex] = useState(0);
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-30, 30]);

    const card = items[index];
    const nextCard = items[index + 1];
    const remaining = items.length - index;

    // 无限滚动：剩余卡片不足时预加载
    useEffect(() => {
        if (remaining <= PRELOAD_THRESHOLD && onNeedMore) {
            onNeedMore();
        }
    }, [remaining, onNeedMore]);

    const handleVote = (vote: boolean) => {
        setIndex(i => i + 1);
        onCardComplete?.();
    }

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.x > 100) {
            handleVote(true);
        } else if (info.offset.x < -100) {
            handleVote(false);
        }
    };

    if (!card) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                <div className="p-4 bg-muted rounded-full">
                    <RefreshCw className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium">今日复习完成！</h3>
                <p className="text-muted-foreground">明天再来看看新的复习卡片吧。</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[60vh] md:h-[65vh] flex items-center justify-center mt-8">
            <div className="relative w-full h-full">
                {/* Next Card (Background) */}
                {nextCard && (
                    <div key={nextCard.id} className="absolute inset-0 top-4 scale-95 opacity-50 z-0 transition-transform duration-300">
                        <WordCard data={nextCard} />
                    </div>
                )}

                {/* Top Card (Active) */}
                <motion.div
                    key={card.id}
                    className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                    style={{ x, rotate }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={handleDragEnd}
                    whileTap={{ scale: 1.02 }}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                    <WordCard data={card} isActive />
                </motion.div>
            </div>

            {/* Controls */}
            <div className="absolute -bottom-28 w-full flex justify-center gap-12 items-center">
                <Button size="icon" variant="outline" className="w-16 h-16 rounded-full border-2 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-600 transition-all hover:scale-110" onClick={() => handleVote(false)}>
                    <X className="w-8 h-8" />
                </Button>
                <Button size="icon" variant="outline" className="w-16 h-16 rounded-full border-2 border-primary/30 text-primary hover:bg-primary/10 transition-all hover:scale-110 shadow-lg shadow-primary/10" onClick={() => handleVote(true)}>
                    <Check className="w-8 h-8" />
                </Button>
            </div>
        </div>
    )
}
