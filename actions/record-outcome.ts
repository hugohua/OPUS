'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { RecordOutcomeSchema, RecordOutcomeInput } from '@/lib/validations/briefing';
import { fsrs, Card, State, Rating } from 'ts-fsrs';
import { calculateImplicitGrade } from '@/lib/algorithm/grading';
import { calculateMasteryScore } from '@/lib/algorithm/mastery';
import { auth } from '@/auth'; // [Security Fix]
import { auditFSRSTransition } from '@/lib/services/audit-service';

const log = createLogger('actions:record-outcome');

// Global FSRS Scheduler Instance
const scheduler = fsrs({
    // Default parameters (optional, can tune later)
});

// --- Helper: Mode to Track Mapping ---
function mapModeToTrack(mode: string): string {
    // L0: Syntax/Visual -> VISUAL
    if (['SYNTAX', 'VISUAL', 'BLITZ', 'PHRASE'].includes(mode)) return 'VISUAL';
    // L1: Audio -> AUDIO
    if (['AUDIO', 'CHUNKING'].includes(mode)) return 'AUDIO';
    // L2: Context -> CONTEXT
    if (['CONTEXT', 'NUANCE', 'READING'].includes(mode)) return 'CONTEXT';

    // Default fallback
    return 'VISUAL';
}

export async function recordOutcome(
    input: RecordOutcomeInput
): Promise<ActionState<any>> {
    try {
        // [Security Fix] Validate Session
        const session = await auth();
        if (!session?.user?.id) {
            return { status: 'error', message: 'Unauthorized' };
        }

        // 1. Validate Input
        const { userId, vocabId, grade, mode, track: explicitTrack } = RecordOutcomeSchema.parse(input);

        // [Security Fix] Vertical Privilege Escalation Check
        if (session.user.id !== userId) {
            log.warn({ sessionUser: session.user.id, inputUser: userId }, 'Security Alert: User mismatch in recordOutcome');
            return { status: 'error', message: 'Forbidden: ID Mismatch' };
        }

        // [Track Priority] Use explicit track if provided, otherwise fallback to mode mapping
        const track = explicitTrack || mapModeToTrack(mode);

        // [Safety] Warn if Blitz mode without explicit track (potential Zombie Review)
        if (!explicitTrack && mode === 'BLITZ') {
            log.warn({ userId, vocabId }, 'BLITZ mode without explicit track - potential Zombie Review risk');
        }

        log.info({ userId, vocabId, grade, mode, track, explicitTrack }, 'Recording outcome (Multi-Track)');

        // 2. Fetch Current Progress (Track-Specific)
        // We use the composite unique key: userId_vocabId_track
        const progress = await prisma.userProgress.findUnique({
            where: {
                userId_vocabId_track: { userId, vocabId, track }
            },
        });

        if (!progress) {
            log.info('Creating new UserProgress entry for track ' + track);
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

        // [Cross-Track Policy] Conservative grading when review modality doesn't match training modality
        const inferredTrack = mapModeToTrack(mode);
        if (explicitTrack && explicitTrack !== inferredTrack && grade === 4) {
            log.info(
                { vocabId, sourceTrack: explicitTrack, reviewMode: mode },
                'Cross-track review: capping Easy(4) -> Good(3)'
            );
            finalGrade = 3; // Cap Easy to Good for cross-modal reviews
        }

        // [Implicit Grading Logic] (Shared Algorithm)
        if (finalGrade >= 3 && input.duration) {
            finalGrade = calculateImplicitGrade(finalGrade, input.duration, !!input.isRetry, mode) as any;
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
        // A: Audio (L1)
        // X: Context (L2)
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

        if (track === 'AUDIO') {
            const newScore = Math.max(0, Math.min(100, currentScores.dim_a_score + scoreChange));
            dimUpdate.dim_a_score = newScore;
            currentScores.dim_a_score = newScore;
        } else if (track === 'CONTEXT') {
            const newScore = Math.max(0, Math.min(100, currentScores.dim_x_score + scoreChange));
            dimUpdate.dim_x_score = newScore;
            currentScores.dim_x_score = newScore;
        } else {
            // VISUAL (Syntax / Phrase)
            if (mode === 'PHRASE') {
                const newScore = Math.max(0, Math.min(100, currentScores.dim_c_score + scoreChange));
                dimUpdate.dim_c_score = newScore;
                currentScores.dim_c_score = newScore;
            } else {
                const newScore = Math.max(0, Math.min(100, currentScores.dim_v_score + scoreChange));
                dimUpdate.dim_v_score = newScore;
                currentScores.dim_v_score = newScore;
            }
        }

        // 6. Calculate Mastery Score
        const masteryScore = calculateMasteryScore(currentScores);

        // 7. DB Upsert (Track Specific)
        const updated = await prisma.userProgress.upsert({
            where: {
                userId_vocabId_track: { userId, vocabId, track }
            },
            update: {
                ...dimUpdate,
                masteryScore,
                track, // Ensure track is set
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
                track, // New Field
                ...dimUpdate,
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

        // --- [V5.1] Panoramic Audit: FSRS Transition Logging ---
        const GRADE_LABELS: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
        auditFSRSTransition(userId, {
            vocabId,
            mode,
            track,
            prevState: progress?.state ?? 0,
            prevStability: progress?.stability ?? 0,
            grade: finalGrade,
            gradeLabel: GRADE_LABELS[finalGrade] || 'Unknown',
            reps: progress?.reps ?? 0
        }, {
            newState: newCard.state,
            newStability: newCard.stability,
            scheduledDays: newCard.scheduled_days ?? 0,
            masteryChange: dimUpdate
        }, {
            extraTags: explicitTrack && explicitTrack !== inferredTrack ? ['cross_track_review'] : []
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
