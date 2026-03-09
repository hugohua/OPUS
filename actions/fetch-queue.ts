'use server';

import { fetchOMPSCandidates, OMPS_ARENA_CONFIG, OMPSCandidate } from '@/lib/services/omps-core';
import { createLogger } from '@/lib/logger';
import type { ActionState } from '@/types';

const log = createLogger('actions/fetch-queue');

export interface HybridQueuePayload {
    rescue: OMPSCandidate[];
    review: OMPSCandidate[];
    new: OMPSCandidate[];
    all: OMPSCandidate[];
    counts: {
        rescue: number;
        review: number;
        new: number;
        total: number;
    }
}

/**
 * Fetch Daily Queue Action (V3 — OMPS Unified)
 * 
 * 功能：
 *   获取今日待学习词汇队列 (20 slots)
 *   逻辑：OMPS Arena 30/50/20 协议
 */
export async function fetchQueueAction(userId: string): Promise<ActionState<HybridQueuePayload>> {
    try {
        log.info({ userId }, 'Fetching daily queue via OMPS...');

        const candidates = await fetchOMPSCandidates(userId, 20, OMPS_ARENA_CONFIG);

        // 按 source 分组（向后兼容 HybridQueuePayload）
        const rescue = candidates.filter(c => c.source === 'rescue');
        const review = candidates.filter(c => c.source === 'review' || c.source === 'hot');
        const newItems = candidates.filter(c => c.source === 'new');

        const payload: HybridQueuePayload = {
            rescue,
            review,
            new: newItems,
            all: candidates,
            counts: {
                rescue: rescue.length,
                review: review.length,
                new: newItems.length,
                total: candidates.length
            }
        };

        log.info({ counts: payload.counts }, 'Queue fetched successfully');

        return {
            status: 'success',
            message: 'Queue fetched successfully',
            data: payload
        };

    } catch (error) {
        log.error({ error }, 'Failed to fetch queue');
        return {
            status: 'error',
            message: 'Failed to fetch daily queue',
            fieldErrors: {},
        };
    }
}
