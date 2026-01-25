'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { RecordOutcomeSchema, RecordOutcomeInput } from '@/lib/validations/briefing';
import { fsrs, Card, State, Rating } from 'ts-fsrs';

const log = createLogger('actions:record-outcome');

// Global FSRS Scheduler Instance
const scheduler = fsrs({
    // Default parameters (optional, can tune later)
});

export async function recordOutcome(
    input: RecordOutcomeInput
): Promise<ActionState<any>> {
    try {
        // 1. Validate Input
        const { userId, vocabId, grade, mode } = RecordOutcomeSchema.parse(input);
        log.info({ userId, vocabId, grade }, 'Recording outcome');

        // 2. Fetch Current Progress
        const progress = await prisma.userProgress.findUnique({
            where: { userId_vocabId: { userId, vocabId } },
        });

        if (!progress) {
            log.info('Creating new UserProgress entry');
        }

        // 3. Construct FSRS Card
        // Note: ts-fsrs might require learning_steps?
        const now = new Date();

        // Default empty card
        let card: Card = {
            due: now,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            state: State.New,
            last_review: undefined,
            learning_steps: 0,
        };

        if (progress) {
            card = {
                due: progress.next_review_at || now,
                stability: progress.stability,
                difficulty: progress.difficulty,
                elapsed_days: progress.last_review_at
                    ? (now.getTime() - progress.last_review_at.getTime()) / (1000 * 60 * 60 * 24)
                    : 0,
                scheduled_days: 0,
                reps: progress.reps,
                lapses: progress.lapses,
                state: progress.state as State,
                last_review: progress.last_review_at || undefined,
                learning_steps: 0,
            };
        }

        // 4. Calculate Next Schedule
        const scheduling_cards = scheduler.repeat(card, now);

        let finalGrade = grade;

        // [Implicit Grading Logic]
        // Only adjust if passed (Grade >= 3) and not manually "Easy" (unless verified)
        // If Grade is 1 (Fail), we respect it regardless of time.
        if (grade >= 3 && input.duration) {
            if (input.isRetry) {
                // [Retry Cap]
                // If this is a retry within the same session, cap at Good (3).
                // Never allow Easy (4) for immediate corrections to prevent stability overestimation.
                finalGrade = 3;
                log.info({ userId, vocabId, duration: input.duration }, 'Retry Cap applied: Forced Grade 3');
            } else {
                // [Time-Based Grading]
                if (input.duration < 1500) {
                    finalGrade = 4; // Easy (< 1.5s)
                    log.info({ userId, vocabId, duration: input.duration }, 'Implicit Grading: Easy (< 1.5s)');
                } else if (input.duration > 5000) {
                    finalGrade = 2; // Hard (> 5s)
                    log.info({ userId, vocabId, duration: input.duration }, 'Implicit Grading: Hard (> 5s)');
                } else {
                    finalGrade = 3; // Good (1.5s - 5s)
                    log.info({ userId, vocabId, duration: input.duration }, 'Implicit Grading: Good (Normal)');
                }
            }
        }

        const rating = finalGrade as Rating; // 1 | 2 | 3 | 4
        // Cast to any because ts-fsrs types might be tricky with index access
        const result = (scheduling_cards as any)[rating];

        if (!result) {
            throw new Error(`Invalid FSRS Grade calculation for rating: ${rating}`);
        }

        const newCard = result.card;

        // 5. Update Game Score (V-Dim)
        let vScoreChange = 0;
        if (grade >= 3) vScoreChange = 1;
        else vScoreChange = -1;

        let currentVScore = progress?.dim_v_score || 0;
        // Scale 0-100, +5/-5 per action
        let newVScore = Math.max(0, Math.min(100, currentVScore + (vScoreChange * 5)));

        // 6. DB Upsert
        const updated = await prisma.userProgress.upsert({
            where: { userId_vocabId: { userId, vocabId } },
            update: {
                dim_v_score: newVScore,
                stability: newCard.stability,
                difficulty: newCard.difficulty,
                reps: newCard.reps,
                lapses: newCard.lapses,
                state: newCard.state,
                next_review_at: newCard.due,
                last_review_at: now,
                status: newCard.state === State.Review ? 'REVIEW' : 'LEARNING',
            },
            create: {
                userId,
                vocabId,
                dim_v_score: newVScore,
                stability: newCard.stability,
                difficulty: newCard.difficulty,
                reps: newCard.reps,
                lapses: newCard.lapses,
                state: newCard.state,
                next_review_at: newCard.due,
                last_review_at: now,
                status: 'LEARNING',
                dueDate: newCard.due, // Legacy field
            }
        });

        return {
            status: 'success',
            message: 'Outcome recorded',
            data: updated
        };

    } catch (error: any) {
        log.error({ error }, 'recordOutcome failed');
        return {
            status: 'error',
            message: error.message || 'Failed to record outcome',
        };
    }
}
