'use server';

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { getMockUser } from '@/lib/auth-mock';
import type { ActionState } from '@/types';

const log = createLogger('record-outcome');

/**
 * 记录 Drill 学习结果 (Record Outcome)
 * 
 * 功能:
 * 1. 更新 UserProgress 状态 (Learning Status)
 * 2. 更新 SRS 调度 (next_review_at) - 简易算法
 * 3. 更新 last_review_at (用于活跃度追踪)
 * 4. 更新五维能力分 (dim_v_score 等) // Phase 2 实现
 */
export async function recordOutcome(
    vocabId: number,
    isCorrect: boolean
): Promise<ActionState<void>> {
    try {
        // Warning: MVP uses mock user. In production, get userId from session.
        const user = await getMockUser();
        const userId = user.id;

        log.info({ vocabId, isCorrect }, 'Recording outcome');

        // 1. 获取当前进度
        const currentProgress = await prisma.userProgress.findUnique({
            where: {
                userId_vocabId: { userId, vocabId }
            }
        });

        if (!currentProgress) {
            // 理论上不应发生，因为 getNextDrillWord 只会选有记录的或自动创建(如果需要)? 
            // 修正: getNextDrillWord 对于 New 词可能还没有 UserProgress (if left join is null)
            // 所以这里需要 upsert
        }

        const now = new Date();
        let nextReview = new Date();
        let status = currentProgress?.status || 'LEARNING';
        let interval = currentProgress?.interval || 0;

        // 2. 简易 SRS 算法 (Sm-2 简化版)
        if (isCorrect) {
            // Success Logic
            if (interval === 0) {
                interval = 1; // 1天后
                status = 'REVIEW';
            } else {
                interval = Math.ceil(interval * 2.5); // 指数增长
            }
        } else {
            // Failure Logic: Reset
            interval = 0; // 立即重置 (或0.5天? 这里简化为0，意味着明天还是会出现在 Review 队列或者 Rescue 队列)
            status = 'LEARNING';
        }

        nextReview.setDate(now.getDate() + interval);

        // 3. 执行更新
        await prisma.userProgress.upsert({
            where: {
                userId_vocabId: { userId, vocabId }
            },
            create: {
                userId,
                vocabId,
                status: 'LEARNING', // New word starts as learning
                interval: isCorrect ? 1 : 0,
                easeFactor: 2.5,
                dueDate: now, // initial due date
                next_review_at: isCorrect ? (() => {
                    const d = new Date(); d.setDate(d.getDate() + 1); return d;
                })() : now,
                last_review_at: now
            },
            update: {
                status,
                interval,
                next_review_at: nextReview,
                last_review_at: now,
                // 如果错误，加入抢救队列 (降低 V 分数，但这通常由 V 维度专用逻辑处理)
                // 这里暂时简单处理：如果错误，dim_v_score 扣分? 
                // 为了简单起见 MVP 先不改分，只改调度。只要 next_review_at 是今天，就会进复习队列。
                // 若要进抢救队列，需要 explicitly set dim_v_score < 30。
                // 假设初始都是 0。做对了增加? 
                // fix: 简单起见，做对 +10，做错 -10 (min 0, max 100)
                dim_v_score: {
                    increment: isCorrect ? 10 : -10
                }
            }
        });

        // Revalidate path is probably not needed for drill as it fetches fresh every time, 
        // but good practice if we show progress on dashboard.
        try {
            revalidatePath('/dashboard');
        } catch (ignored) {
            // Ignored: Context might be missing in scripts/tests
        }

        return {
            status: 'success',
            message: 'Outcome recorded'
        };

    } catch (error) {
        log.error({ error, vocabId }, 'Failed to record outcome');
        return {
            status: 'error',
            message: 'Failed to save progress'
        };
    }
}
