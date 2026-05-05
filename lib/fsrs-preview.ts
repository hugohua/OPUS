import { fsrs, type Card, State, Rating } from 'ts-fsrs';

const scheduler = fsrs();

export interface FSRSCardState {
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview?: string;
}

export interface FSRSPreview {
    again: string;
    hard: string;
    good: string;
    easy: string;
}

function formatDays(days: number): string {
    if (days < 1 / 1440) return '<1m';
    if (days < 1 / 24) return `${Math.round(days * 1440)}m`;
    if (days < 1) return `${Math.round(days * 24)}h`;
    if (days === 1) return '1d';
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}mo`;
}

export function previewIntervals(cardState?: FSRSCardState): FSRSPreview {
    const now = new Date();
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

    if (card.last_review) {
        const elapsed = (now.getTime() - card.last_review.getTime()) / (1000 * 60 * 60 * 24);
        card.elapsed_days = Math.max(0, Math.floor(elapsed));
    }

    const scheduling = scheduler.repeat(card, now);

    return {
        again: formatDays((scheduling as any)[Rating.Again]?.card?.scheduled_days ?? 0),
        hard: formatDays((scheduling as any)[Rating.Hard]?.card?.scheduled_days ?? 0),
        good: formatDays((scheduling as any)[Rating.Good]?.card?.scheduled_days ?? 0),
        easy: formatDays((scheduling as any)[Rating.Easy]?.card?.scheduled_days ?? 0),
    };
}
