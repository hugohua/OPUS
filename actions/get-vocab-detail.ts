'use server';

import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function getVocabDetail(identifier: number | string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Determine if identifier is ID or Word
    const isId = typeof identifier === 'number' || !isNaN(Number(identifier));

    const vocab = await prisma.vocab.findUnique({
        where: isId
            ? { id: Number(identifier) }
            : { word: String(identifier) },
        include: {
            etymology: true,
        },
    });

    if (!vocab) {
        return null;
    }

    // [Phase 5] Fetch Multi-Track Progress
    // We fetch ALL tracks for this user + vocab combination
    const progressList = await prisma.userProgress.findMany({
        where: {
            userId: session.user.id,
            vocabId: vocab.id,
        },
    });

    // Transform to structured tracks object
    const tracks = {
        VISUAL: progressList.find(p => p.track === 'VISUAL') || null,
        AUDIO: progressList.find(p => p.track === 'AUDIO') || null,
        CONTEXT: progressList.find(p => p.track === 'CONTEXT') || null,
    };

    // Backward compatibility for existing UI
    const progress = tracks.VISUAL;

    return {
        vocab,
        progress, // Legacy support
        tracks,   // New Multi-Track Data
    };
}
