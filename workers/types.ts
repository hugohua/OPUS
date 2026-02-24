import { z } from 'zod';

export interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string | null;
    word_family: any;
    collocations?: any;
    type?: 'NEW' | 'REVIEW';
    reviewData?: any;
    confusion_audio?: string[];
    synonyms?: string[];
    scenario?: string;
    commonExample?: string | null;
    partOfSpeech?: string | null;
    etymology?: any;
    phoneticUs?: string | null;
    phoneticUk?: string | null;
}

// AI 输出 Schema (Reusable)
export const SingleDrillSchema = z.object({
    meta: z.object({
        format: z.string().optional(),
        target_word: z.string().optional(),
    }),
    segments: z.array(z.any()),
});

export const BatchDrillOutputSchema = z.object({
    items: z.array(SingleDrillSchema),
});
