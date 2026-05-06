import { prisma } from "@/lib/db";

export async function getVocabDetailForUser(userId: string, identifier: number | string) {
    const isId = typeof identifier === "number" || !Number.isNaN(Number(identifier));

    const vocab = await prisma.vocab.findUnique({
        where: isId ? { id: Number(identifier) } : { word: String(identifier) },
        include: {
            etymology: true,
        },
    });

    if (!vocab) {
        return null;
    }

    const progressList = await prisma.userProgress.findMany({
        where: {
            userId,
            vocabId: vocab.id,
        },
    });

    const tracks = {
        VISUAL: progressList.find((progress) => progress.track === "VISUAL") || null,
        AUDIO: progressList.find((progress) => progress.track === "AUDIO") || null,
        CONTEXT: progressList.find((progress) => progress.track === "CONTEXT") || null,
    };

    const progress = tracks.VISUAL;
    let userTags: string[] = [];
    let userNote = "";

    if (progress?.masteryMatrix) {
        const matrix = progress.masteryMatrix as Record<string, any>;
        if (Array.isArray(matrix.userTags)) {
            userTags = matrix.userTags;
        }
        if (typeof matrix.userNote === "string") {
            userNote = matrix.userNote;
        }
    }

    return {
        vocab,
        progress,
        tracks,
        userTags,
        userNote,
    };
}
