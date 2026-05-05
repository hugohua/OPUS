import { Prisma } from '@prisma/client';

export function buildNotMasteredVocabWhere(userId: string): Prisma.VocabWhereInput {
    return {
        userVocabStates: {
            none: {
                userId,
                status: 'MASTERED',
            },
        },
    };
}

export function buildNotMasteredProgressWhere(userId: string): Prisma.UserProgressWhereInput {
    return {
        vocab: buildNotMasteredVocabWhere(userId),
    };
}
