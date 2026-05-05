import { getNextDrillBatch } from "@/actions/get-next-drill";
import { getReviewCards } from "@/app/dashboard/cards/actions";
import { calculateImplicitGrade } from "@/lib/algorithm/grading";
import { calculateMasteryScore } from "@/lib/algorithm/mastery";
import { prisma } from "@/lib/db";
import { auditFSRSTransition } from "@/lib/services/audit-service";
import { getAudioSessionForUser } from "@/lib/session/audio";
import { GetBriefingSchema, RatingSchema, SessionModeSchema } from "@/lib/validations/briefing";
import { type ActionState } from "@/types/action";
import { previewIntervals } from "@/lib/fsrs-preview";
import { type WordAsset } from "@/types/word";
import { Card, Rating, State, fsrs } from "ts-fsrs";
import { z } from "zod";

export type MobileTrainingEntryAvailability = {
    key: string;
    title: string;
    available: boolean;
    reason?: string;
    count: number;
};

export async function getMobileAudioAvailability(userId: string) {
    const result = await getAudioSessionForUser(userId);
    const items = result.items;

    return {
        key: "audio",
        title: "听力训练",
        available: items.length > 0,
        reason: items.length > 0 ? undefined : "暂无到期听力复习，稍后再来。",
        count: items.length,
        items,
    };
}

export async function getMobileReviewCards(limit = 20, userId: string): Promise<WordAsset[]> {
    return getReviewCards(limit, [], userId);
}

const scheduler = fsrs({});

const MobileSessionBatchSchema = GetBriefingSchema.omit({ userId: true });

const MobileSessionOutcomeSchema = z.object({
    vocabId: z.number().int(),
    grade: RatingSchema,
    mode: SessionModeSchema,
    track: z.enum(["VISUAL", "AUDIO", "CONTEXT"]).optional(),
    duration: z.number().int().nonnegative().optional(),
    isRetry: z.boolean().optional(),
    contextSentence: z.string().optional(),
});

export const MobileAudioGradeSchema = z.object({
    vocabId: z.number().int().positive(),
    grade: RatingSchema,
    duration: z.number().int().nonnegative().optional(),
});

export type MobileSessionBatchInput = z.input<typeof MobileSessionBatchSchema>;
export type MobileSessionOutcomeInput = z.infer<typeof MobileSessionOutcomeSchema>;
export type MobileAudioGradeInput = z.infer<typeof MobileAudioGradeSchema>;

function mapModeToTrack(mode: string): "VISUAL" | "AUDIO" | "CONTEXT" {
    if (["SYNTAX", "VISUAL", "BLITZ", "PHRASE", "CHUNKING", "ARENA_PART5", "ARENA_PART6"].includes(mode)) {
        return "VISUAL";
    }
    if (mode === "AUDIO") {
        return "AUDIO";
    }
    if (["CONTEXT", "NUANCE", "READING"].includes(mode)) {
        return "CONTEXT";
    }
    return "VISUAL";
}

export async function getMobileSessionBatch(input: MobileSessionBatchInput, userId: string) {
    const validated = MobileSessionBatchSchema.parse(input);
    const result = await getNextDrillBatch({
        userId,
        ...validated,
    });

    if (result.status === "error") {
        throw new Error(result.message);
    }

    return (result.data ?? []).map((drill: any) => {
        if (!drill?.meta?.fsrsCard) return drill;
        return {
            ...drill,
            fsrsPreview: previewIntervals(drill.meta.fsrsCard),
        };
    });
}

export async function submitMobileSessionOutcome(
    input: MobileSessionOutcomeInput,
    userId: string
): Promise<ActionState<any>> {
    const validated = MobileSessionOutcomeSchema.parse(input);

    if (validated.vocabId <= 0) {
        return {
            status: "success",
            message: "Outcome recorded (Skip FSRS for Pure Grammar)",
            data: null,
        };
    }

    return recordOutcomeForUser(userId, validated);
}

export async function submitMobileAudioGrade(
    input: MobileAudioGradeInput,
    userId: string
): Promise<ActionState<any>> {
    const validated = MobileAudioGradeSchema.parse(input);

    return recordOutcomeForUser(userId, {
        ...validated,
        mode: "AUDIO",
    });
}

async function recordOutcomeForUser(
    userId: string,
    input: MobileSessionOutcomeInput
): Promise<ActionState<any>> {
    const { vocabId, grade, mode, track: explicitTrack } = input;
    const wordState = await prisma.userVocabState.findUnique({
        where: {
            userId_vocabId: { userId, vocabId },
        },
        select: { status: true },
    });

    if (wordState?.status === "MASTERED") {
        return {
            status: "success",
            message: "Outcome ignored for mastered vocab",
            data: null,
        };
    }

    const track = explicitTrack ?? mapModeToTrack(mode);
    const progress = await prisma.userProgress.findUnique({
        where: {
            userId_vocabId_track: { userId, vocabId, track },
        },
    });

    const now = new Date();
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

    const schedulingCards = scheduler.repeat(card, now) as unknown as Record<Rating, { card: Card }>;
    const inferredTrack = mapModeToTrack(mode);

    let finalGrade = grade as Rating;
    if (explicitTrack && explicitTrack !== inferredTrack && grade === 4) {
        finalGrade = 3 as Rating;
    }

    if (finalGrade >= 3 && input.duration) {
        finalGrade = calculateImplicitGrade(finalGrade, input.duration, !!input.isRetry, mode) as Rating;
    }

    const result = schedulingCards[finalGrade];
    if (!result) {
        throw new Error(`Invalid FSRS Grade calculation for rating: ${finalGrade}`);
    }

    const currentScores = {
        dim_v_score: progress?.dim_v_score || 0,
        dim_c_score: progress?.dim_c_score || 0,
        dim_a_score: progress?.dim_a_score || 0,
        dim_m_score: progress?.dim_m_score || 0,
        dim_x_score: progress?.dim_x_score || 0,
    };

    const scoreDeltas: Record<number, number> = { 1: -10, 2: -3, 3: 3, 4: 8 };
    let scoreChange = scoreDeltas[finalGrade] ?? -5;
    const gradeLabels: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };
    if (!progress && finalGrade <= 2) {
        scoreChange = 0;
    }

    const dimUpdate: Partial<Record<"dim_v_score" | "dim_c_score" | "dim_a_score" | "dim_x_score", number>> = {};
    if (track === "AUDIO") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_a_score + scoreChange));
        currentScores.dim_a_score = nextScore;
        dimUpdate.dim_a_score = nextScore;
    } else if (track === "CONTEXT") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_x_score + scoreChange));
        currentScores.dim_x_score = nextScore;
        dimUpdate.dim_x_score = nextScore;
    } else if (mode === "PHRASE") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_c_score + scoreChange));
        currentScores.dim_c_score = nextScore;
        dimUpdate.dim_c_score = nextScore;
    } else {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_v_score + scoreChange));
        currentScores.dim_v_score = nextScore;
        dimUpdate.dim_v_score = nextScore;
    }

    const masteryScore = calculateMasteryScore(currentScores);
    const newCard = result.card;
    const updated = await prisma.$transaction(async (tx) => {
        const txWordState = await tx.userVocabState.findUnique({
            where: {
                userId_vocabId: { userId, vocabId },
            },
            select: { status: true },
        });

        if (txWordState?.status === "MASTERED") {
            return null;
        }

        const nextProgress = await tx.userProgress.upsert({
            where: {
                userId_vocabId_track: { userId, vocabId, track },
            },
            update: {
                ...dimUpdate,
                masteryScore,
                track,
                stability: newCard.stability,
                difficulty: newCard.difficulty,
                reps: newCard.reps,
                lapses: newCard.lapses,
                state: newCard.state,
                next_review_at: newCard.due,
                last_review_at: now,
                status: newCard.state === State.Review ? "REVIEW" : "LEARNING",
                ...(input.contextSentence ? { lastContextSentence: input.contextSentence } : {}),
            },
            create: {
                userId,
                vocabId,
                track,
                ...dimUpdate,
                masteryScore,
                stability: newCard.stability,
                difficulty: newCard.difficulty,
                reps: newCard.reps,
                lapses: newCard.lapses,
                state: newCard.state,
                next_review_at: newCard.due,
                last_review_at: now,
                status: "LEARNING",
                dueDate: newCard.due,
                lastContextSentence: input.contextSentence || null,
            },
        });

        await auditFSRSTransition(userId, {
            vocabId,
            mode,
            track,
            prevState: progress?.state ?? 0,
            prevStability: progress?.stability ?? 0,
            grade: finalGrade,
            gradeLabel: gradeLabels[finalGrade],
            reps: progress?.reps ?? 0,
        }, {
            newState: newCard.state,
            newStability: newCard.stability,
            scheduledDays: newCard.scheduled_days ?? 0,
            masteryChange: dimUpdate,
        }, {
            extraTags: explicitTrack && explicitTrack !== inferredTrack ? ["cross_track_review"] : [],
        }, tx);

        return nextProgress;
    });

    return {
        status: "success",
        message: updated ? "Outcome recorded" : "Outcome ignored for mastered vocab",
        data: updated,
    };
}
