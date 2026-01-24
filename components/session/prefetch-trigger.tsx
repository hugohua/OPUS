/**
 * PrefetchTrigger - 静默预取触发器
 * 功能：
 *   在 Dashboard Layout 挂载时静默触发 Drill 缓存预取
 *   不影响页面渲染性能
 */
'use client';

import { useEffect, useRef } from 'react';
import { prefetchDrills } from '@/actions/prefetch-drills';

export function PrefetchTrigger() {
    const hasPrefetched = useRef(false);

    useEffect(() => {
        // 防止重复触发（StrictMode 双渲染）
        if (hasPrefetched.current) return;
        hasPrefetched.current = true;

        // Fire and forget - 不阻塞任何 UI
        prefetchDrills().catch(() => {
            // 静默失败，不影响用户体验
        });
    }, []);

    // 不渲染任何内容
    return null;
}
