/**
 * FSRS 预览计算 (客户端)
 * 
 * 功能：
 *   根据当前卡片的 FSRS 状态，预计算 4 种评分的复习间隔。
 *   用于 ControlDeck Grade 按钮上显示真实间隔。
 * 
 * 使用方法：
 *   import { previewIntervals } from '@/lib/client/fsrs-preview';
 *   const intervals = previewIntervals(drill.meta.fsrsCard);
 */

import { fsrs, type Card, State, Rating } from 'ts-fsrs';

// 复用单例 Scheduler (默认参数，与 record-outcome 保持一致)
const scheduler = fsrs();

/** FSRS Card 状态 (从 BriefingPayload.meta 下发) */
export interface FSRSCardState {
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: number;  // 0=New, 1=Learning, 2=Review, 3=Relearning
    lastReview?: string; // ISO 字符串
}

/** 预览间隔结果 */
export interface FSRSPreview {
    again: string;
    hard: string;
    good: string;
    easy: string;
}

/**
 * 格式化天数为人类可读字符串
 * <1min -> "<1m", 5min -> "5m", 12h -> "12h", 1d, 2w, 3mo
 */
function formatDays(days: number): string {
    if (days < 1 / 1440) return '<1m';       // < 1 分钟
    if (days < 1 / 24) {                      // < 1 小时 -> 显示分钟
        return `${Math.round(days * 1440)}m`;
    }
    if (days < 1) {                           // < 1 天 -> 显示小时
        return `${Math.round(days * 24)}h`;
    }
    if (days === 1) return '1d';
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) {
        const weeks = Math.round(days / 7);
        return `${weeks}w`;
    }
    const months = Math.round(days / 30);
    return `${months}mo`;
}

/**
 * 预计算 4 种评分的复习间隔
 * 
 * @param cardState - BriefingPayload.meta.fsrsCard (可选)
 * @returns 格式化后的间隔字符串
 */
export function previewIntervals(cardState?: FSRSCardState): FSRSPreview {
    const now = new Date();

    // 构建 ts-fsrs Card 对象
    const card: Card = {
        due: now,
        stability: cardState?.stability ?? 0,
        difficulty: cardState?.difficulty ?? 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: cardState?.reps ?? 0,
        lapses: cardState?.lapses ?? 0,
        state: (cardState?.state ?? State.New) as State,
        last_review: cardState?.lastReview ? new Date(cardState.lastReview) : undefined,
        learning_steps: 0,
    };

    // 如果有上次复习时间，计算 elapsed_days
    if (card.last_review) {
        const elapsed = (now.getTime() - card.last_review.getTime()) / (1000 * 60 * 60 * 24);
        card.elapsed_days = Math.max(0, Math.floor(elapsed));
    }

    // 调用 FSRS 预览 (只读，不影响任何状态)
    const scheduling = scheduler.repeat(card, now);

    // 提取 4 种评分的 scheduled_days
    const againDays = (scheduling as any)[Rating.Again]?.card?.scheduled_days ?? 0;
    const hardDays = (scheduling as any)[Rating.Hard]?.card?.scheduled_days ?? 0;
    const goodDays = (scheduling as any)[Rating.Good]?.card?.scheduled_days ?? 0;
    const easyDays = (scheduling as any)[Rating.Easy]?.card?.scheduled_days ?? 0;

    return {
        again: formatDays(againDays),
        hard: formatDays(hardDays),
        good: formatDays(goodDays),
        easy: formatDays(easyDays),
    };
}
