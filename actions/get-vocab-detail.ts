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
    });

    if (!vocab) {
        return null;
    }

    // Fetch UserProgress for Track A (Visual) as primary
    const progress = await prisma.userProgress.findUnique({
        where: {
            userId_vocabId_track: {
                userId: session.user.id,
                vocabId: vocab.id, // Use resolved ID
                track: "VISUAL",
            },
        },
    });



    return {
        vocab,
        progress,
    };
}
