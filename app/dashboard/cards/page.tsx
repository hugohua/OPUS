/**
 * 复习卡组页面
 * 
 * 功能：
 *   从 OMPS 引擎加载真实复习卡片，支持无限滚动。
 *   剩余 ≤5 张时自动预加载下一批。
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CardStack } from '@/components/drill/card-stack';
import { WordAsset } from '@/types/word';
import { getReviewCards } from './actions';
import { Loader2 } from 'lucide-react';

const BATCH_SIZE = 20;

export default function CardsPage() {
    const [cards, setCards] = useState<WordAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalReviewed, setTotalReviewed] = useState(0);
    const loadedIdsRef = useRef<number[]>([]);
    const isFetchingRef = useRef(false);

    // 首次加载
    useEffect(() => {
        loadBatch();
    }, []);

    const loadBatch = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const newCards = await getReviewCards(BATCH_SIZE, loadedIdsRef.current);
            if (newCards.length > 0) {
                const newIds = newCards.map(c => c.id);
                loadedIdsRef.current = [...loadedIdsRef.current, ...newIds].slice(-200); // 上限 200
                setCards(prev => [...prev, ...newCards]);
            }
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, []);

    const handleCardComplete = useCallback(() => {
        setTotalReviewed(prev => prev + 1);
    }, []);

    // 骨架屏
    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-4">加载复习卡片...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 px-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">复习卡组</h1>
                    <p className="text-sm text-muted-foreground">左滑稍后复习</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                    {cards.length} 张卡片
                </div>
            </div>

            {/* Stack Container */}
            <div className="flex-1">
                <CardStack
                    items={cards}
                    onNeedMore={loadBatch}
                    onCardComplete={handleCardComplete}
                />
            </div>
        </div>
    );
}
