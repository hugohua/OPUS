import { DEFAULT_TTS_VOICE } from "@/config/audio";
import { prisma } from "@/lib/db";
import { buildNotMasteredVocabWhere } from "@/lib/vocab-state/filters";
import { z } from "zod";

export const AudioSessionItemSchema = z.object({
    id: z.string(),
    vocabId: z.number(),
    word: z.string(),
    phonetic: z.string().optional(),
    definition: z.string().optional(),
    voice: z.string().default(DEFAULT_TTS_VOICE),
});

export type AudioSessionItem = z.infer<typeof AudioSessionItemSchema>;

export const AudioSessionDataSchema = z.object({
    sessionId: z.string(),
    items: z.array(AudioSessionItemSchema),
});

export type AudioSessionData = z.infer<typeof AudioSessionDataSchema>;

export const SubmitAudioGradeSchema = z.object({
    vocabId: z.number(),
    grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    duration: z.number().optional(),
});

export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;

export async function getAudioSessionForUser(userId: string): Promise<AudioSessionData> {
    const now = new Date();
    const candidates = await prisma.userProgress.findMany({
        where: {
            userId,
            track: "AUDIO",
            status: {
                in: ["LEARNING", "REVIEW", "NEW"],
            },
            next_review_at: { lte: now },
            vocab: buildNotMasteredVocabWhere(userId),
        },
        include: {
            vocab: {
                select: {
                    id: true,
                    word: true,
                    phoneticUk: true,
                    phoneticUs: true,
                    definition_cn: true,
                    frequency_score: true,
                },
            },
        },
        orderBy: [
            { vocab: { frequency_score: "desc" } },
            { next_review_at: "asc" },
        ],
        take: 20,
    });

    return {
        sessionId: crypto.randomUUID(),
        items: candidates.map((progress) => ({
            id: progress.id,
            vocabId: progress.vocab.id,
            word: progress.vocab.word,
            phonetic: progress.vocab.phoneticUs || progress.vocab.phoneticUk || undefined,
            definition: progress.vocab.definition_cn || undefined,
            voice: DEFAULT_TTS_VOICE,
        })),
    };
}
