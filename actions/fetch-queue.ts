'use server';

import { HybridSelector } from '@/lib/engine/hybrid-selector';
import { createLogger } from '@/lib/logger';
import type { ActionState } from '@/types';
import { PrismaClient } from '@prisma/client';
import type { Vocab } from '@prisma/client'; // Changed import path for Vocab

const log = createLogger('actions/fetch-queue');

export interface HybridQueuePayload {
    rescue: Vocab[];
    review: Vocab[];
    new: Vocab[];
    all: Vocab[];
    counts: {
        rescue: number;
        review: number;
        new: number;
        total: number;
    }
}

/**
 * Fetch Daily Queue Action (Hybrid V3.0)
 * 
 * 功能：
 *   获取今日待学习词汇队列 (20 slots)
 *   逻辑：Rescue(30%) / Review(50%) / New(20%)
 * 
 * @param userId - 用户 ID (暂时手动传入，未来从 Session 获取)
 */
export async function fetchQueueAction(userId: string): Promise<ActionState<HybridQueuePayload>> {
    try {
        log.info({ userId }, 'Fetching daily queue...');

        // 1. Call Engine
        const result = await HybridSelector.selectWords(userId);

        // 2. Format Response
        const payload: HybridQueuePayload = {
            rescue: result.rescue,
            review: result.review,
            new: result.new,
            all: result.all,
            counts: {
                rescue: result.rescue.length,
                review: result.review.length,
                new: result.new.length,
                total: result.all.length
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
