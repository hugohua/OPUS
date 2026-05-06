import { z } from "zod";

import { fetchOMPSCandidates, type OMPSCandidate } from "@/lib/services/omps-core";
import { type WordAsset } from "@/types/word";

const GetReviewCardsSchema = z.object({
    limit: z.number().min(1).max(50).default(20),
    excludeIds: z.array(z.number()).max(200).default([]),
});

function toWordAsset(candidate: OMPSCandidate): WordAsset {
    const collocations = Array.isArray(candidate.collocations)
        ? candidate.collocations.map((collocation: any) => ({
            text: collocation.text || "",
            translation: collocation.trans || collocation.translation || undefined,
        }))
        : [];

    return {
        id: candidate.vocabId,
        word: candidate.word,
        phonetic: candidate.phoneticUs || candidate.phoneticUk || undefined,
        meaning: candidate.definition_cn || "",
        word_family: candidate.word_family || undefined,
        collocations,
    };
}

export async function getReviewCardsForUser(
    userId: string,
    limit = 20,
    excludeIds: number[] = []
): Promise<WordAsset[]> {
    const validated = GetReviewCardsSchema.parse({ limit, excludeIds });
    const candidates = await fetchOMPSCandidates(
        userId,
        validated.limit,
        {},
        validated.excludeIds
    );

    return candidates.map(toWordAsset);
}
