/**
 * 移动端 Session 适配器
 * 功能：
 *   负责 iOS Demo API 的输入校验与 DTO 扩展，核心训练业务委托给后端共享核心。
 */
import { getReviewCardsForUser } from "@/lib/backend-core/session/review-cards";
import { getSessionDrillBatchForUser } from "@/lib/backend-core/session/batch";
import { recordSessionOutcomeForUser } from "@/lib/backend-core/session/outcome";
import { getAudioSessionForUser } from "@/lib/session/audio";
import { GetBriefingSchema, RatingSchema, SessionModeSchema } from "@/lib/validations/briefing";
import { type ActionState } from "@/types/action";
import { previewIntervals } from "@/lib/fsrs-preview";
import { type WordAsset } from "@/types/word";
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
    return getReviewCardsForUser(userId, limit);
}

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

export async function getMobileSessionBatch(input: MobileSessionBatchInput, userId: string) {
    const validated = MobileSessionBatchSchema.parse(input);
    const result = await getSessionDrillBatchForUser({
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
    return recordSessionOutcomeForUser(userId, validated);
}

export async function submitMobileAudioGrade(
    input: MobileAudioGradeInput,
    userId: string
): Promise<ActionState<any>> {
    const validated = MobileAudioGradeSchema.parse(input);

    return recordSessionOutcomeForUser(userId, {
        ...validated,
        mode: "AUDIO",
    });
}
