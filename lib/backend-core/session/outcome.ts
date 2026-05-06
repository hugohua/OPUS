/**
 * Session Outcome 共享核心
 * 功能：
 *   以 Web 端规则为主源，统一处理 FSRS 回流、维度分数、跨轨评分和审计写入。
 */
import { fsrs, Card, State, Rating } from "ts-fsrs";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { calculateImplicitGrade } from "@/lib/algorithm/grading";
import { calculateMasteryScore } from "@/lib/algorithm/mastery";
import { auditFSRSTransition } from "@/lib/services/audit-service";
import type { ActionState } from "@/types/action";
import type { RecordOutcomeInput } from "@/lib/validations/briefing";
import { resolveOutcomeTrack } from "./policy";

const log = createLogger("backend-core:session:outcome");
const scheduler = fsrs({});

export type SessionOutcomeForUserInput = Omit<RecordOutcomeInput, "userId">;

type DimensionUpdate = Partial<Record<"dim_v_score" | "dim_c_score" | "dim_a_score" | "dim_x_score", number>>;
type CognitiveScores = {
    dim_v_score: number;
    dim_c_score: number;
    dim_a_score: number;
    dim_m_score: number;
    dim_x_score: number;
};

function buildCardFromProgress(progress: any, now: Date): Card {
    if (!progress) {
        return {
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
    }

    return {
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

function resolveScoreChange(finalGrade: number, hasProgress: boolean): number {
    const scoreChangeMap: Record<number, number> = { 1: -10, 2: -3, 3: 3, 4: 8 };
    if (!hasProgress && finalGrade <= 2) {
        return 0;
    }
    return scoreChangeMap[finalGrade] ?? (finalGrade >= 3 ? 3 : -5);
}

function buildDimensionUpdate(
    input: SessionOutcomeForUserInput,
    track: string,
    scoreChange: number,
    progress: any
): { dimUpdate: DimensionUpdate; currentScores: CognitiveScores } {
    const currentScores: CognitiveScores = {
        dim_v_score: progress?.dim_v_score || 0,
        dim_c_score: progress?.dim_c_score || 0,
        dim_a_score: progress?.dim_a_score || 0,
        dim_m_score: progress?.dim_m_score || 0,
        dim_x_score: progress?.dim_x_score || 0,
    };

    const dimUpdate: DimensionUpdate = {};
    if (track === "AUDIO") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_a_score + scoreChange));
        dimUpdate.dim_a_score = nextScore;
        currentScores.dim_a_score = nextScore;
    } else if (track === "CONTEXT") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_x_score + scoreChange));
        dimUpdate.dim_x_score = nextScore;
        currentScores.dim_x_score = nextScore;
    } else if (input.mode === "PHRASE") {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_c_score + scoreChange));
        dimUpdate.dim_c_score = nextScore;
        currentScores.dim_c_score = nextScore;
    } else {
        const nextScore = Math.max(0, Math.min(100, currentScores.dim_v_score + scoreChange));
        dimUpdate.dim_v_score = nextScore;
        currentScores.dim_v_score = nextScore;
    }

    return { dimUpdate, currentScores };
}

export async function recordSessionOutcomeForUser(
    userId: string,
    input: SessionOutcomeForUserInput
): Promise<ActionState<any>> {
    try {
        const { vocabId, grade, mode, track: explicitTrack } = input;

        if (vocabId <= 0) {
            log.info({ userId, vocabId, mode }, "Skipping FSRS update for pure grammar item");
            return {
                status: "success",
                message: "Outcome recorded (Skip FSRS for Pure Grammar)",
                data: null,
            };
        }

        const wordState = await prisma.userVocabState.findUnique({
            where: {
                userId_vocabId: { userId, vocabId },
            },
            select: { status: true },
        });

        if (wordState?.status === "MASTERED") {
            log.info({ userId, vocabId, mode }, "Skipping FSRS update for word-level MASTERED vocab");
            return {
                status: "success",
                message: "Outcome ignored for mastered vocab",
                data: null,
            };
        }

        const track = explicitTrack || resolveOutcomeTrack(mode);
        const progress = await prisma.userProgress.findUnique({
            where: {
                userId_vocabId_track: { userId, vocabId, track },
            },
        });

        if (!progress) {
            log.info({ userId, vocabId, track }, "Creating new UserProgress entry for track");
        }

        const now = new Date();
        const card = buildCardFromProgress(progress, now);
        const schedulingCards = scheduler.repeat(card, now);
        const inferredTrack = resolveOutcomeTrack(mode);

        let finalGrade = grade as Rating;
        if (explicitTrack && explicitTrack !== inferredTrack && grade === 4) {
            log.info(
                { userId, vocabId, sourceTrack: explicitTrack, reviewMode: mode },
                "Cross-track review: capping Easy(4) -> Good(3)"
            );
            finalGrade = 3 as Rating;
        }

        if (finalGrade >= 3 && input.duration) {
            finalGrade = calculateImplicitGrade(finalGrade, input.duration, !!input.isRetry, mode) as Rating;
        }

        const result = (schedulingCards as any)[finalGrade];
        if (!result) {
            throw new Error(`Invalid FSRS Grade calculation for rating: ${finalGrade}`);
        }

        const scoreChange = resolveScoreChange(finalGrade, !!progress);
        const { dimUpdate, currentScores } = buildDimensionUpdate(input, track, scoreChange, progress);
        const masteryScore = calculateMasteryScore(currentScores);
        const newCard = result.card;
        const gradeLabels: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

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
                gradeLabel: gradeLabels[finalGrade] || "Unknown",
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
    } catch (error: any) {
        log.error({ error }, "recordSessionOutcomeForUser failed");
        return {
            status: "error",
            message: error.message || "Failed to record outcome",
        };
    }
}
