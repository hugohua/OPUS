'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { RecordOutcomeSchema, RecordOutcomeInput } from '@/lib/validations/briefing';
import { fsrs, Card, State, Rating } from 'ts-fsrs';
import { calculateImplicitGrade } from '@/lib/algorithm/grading';
import { calculateMasteryScore } from '@/lib/algorithm/mastery';

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

        // [Implicit Grading Logic] (Shared Algorithm)
        if (grade >= 3 && input.duration) {
            finalGrade = calculateImplicitGrade(grade, input.duration, !!input.isRetry, mode) as any;
        }

        const rating = finalGrade as Rating; // 1 | 2 | 3 | 4
        // Cast to any because ts-fsrs types might be tricky with index access
        const result = (scheduling_cards as any)[rating];

        if (!result) {
            throw new Error(`Invalid FSRS Grade calculation for rating: ${rating}`);
        }

        const newCard = result.card;

        // 5. Update Dimension Score (Targeted Update)
        // V: Syntax/Spelling (Default)
        // C: Phrase/Context (New)
        // Other dims to be implemented
        let dimUpdate: any = {};
        const scoreChange = grade >= 3 ? 5 : -5;

        // Fetch current scores to calculate new ones locally (for mastery calculation)
        const currentScores = {
            dim_v_score: progress?.dim_v_score || 0,
            dim_c_score: progress?.dim_c_score || 0,
            dim_a_score: progress?.dim_a_score || 0,
            dim_m_score: progress?.dim_m_score || 0,
            dim_x_score: progress?.dim_x_score || 0
        };

        if (mode === 'PHRASE') {
            const newScore = Math.max(0, Math.min(100, currentScores.dim_c_score + scoreChange));
            dimUpdate.dim_c_score = newScore;
            currentScores.dim_c_score = newScore;
        } else {
            // Default to V (Syntax/Form)
            const newScore = Math.max(0, Math.min(100, currentScores.dim_v_score + scoreChange));
            dimUpdate.dim_v_score = newScore;
            currentScores.dim_v_score = newScore;
        }

        // 6. Calculate Mastery Score
        const masteryScore = calculateMasteryScore(currentScores);

        // 7. DB Upsert
        const updated = await prisma.userProgress.upsert({
            where: { userId_vocabId: { userId, vocabId } },
            update: {
                ...dimUpdate,
                masteryScore,
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
                ...dimUpdate, // Set initial dim score
                masteryScore,
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
