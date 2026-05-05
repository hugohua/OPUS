import { z } from 'zod';

export const MarkVocabMasteredSchema = z.object({
    vocabId: z.number().int().positive(),
});

export const ToggleVocabFavoriteSchema = z.object({
    vocabId: z.number().int().positive(),
    isFavorite: z.boolean(),
});
