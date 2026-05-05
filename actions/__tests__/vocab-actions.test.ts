import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const revalidatePathMock = vi.fn();

const prismaMock = {
    userVocabState: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
    },
    userProgress: {
        updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock('@/auth', () => ({
    auth: authMock,
}));

vi.mock('@/lib/db', () => ({
    prisma: prismaMock,
    db: prismaMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

describe('vocab-actions word-level state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMock.mockResolvedValue({ user: { id: 'user-1' } });
        prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
        prismaMock.userVocabState.upsert.mockResolvedValue({ userId: 'user-1', vocabId: 42, status: 'MASTERED' });
        prismaMock.userVocabState.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.userProgress.updateMany.mockResolvedValue({ count: 1 });
    });

    it('marks a vocab as MASTERED without changing track FSRS rows', async () => {
        const { markVocabMastered } = await import('../vocab-actions');

        const result = await markVocabMastered(42);

        expect(result).toMatchObject({ status: 'success' });
        expect(prismaMock.userVocabState.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId_vocabId: { userId: 'user-1', vocabId: 42 } },
            update: expect.objectContaining({
                status: 'MASTERED',
                masteredAt: expect.any(Date),
            }),
            create: expect.objectContaining({
                userId: 'user-1',
                vocabId: 42,
                status: 'MASTERED',
                masteredAt: expect.any(Date),
            }),
        }));
        expect(prismaMock.userProgress.updateMany).not.toHaveBeenCalled();
    });

    it('toggles default favorite without changing MASTERED status', async () => {
        const { toggleVocabFavorite } = await import('../vocab-actions');

        const result = await toggleVocabFavorite(42, true);

        expect(result).toMatchObject({
            status: 'success',
            data: { isFavorite: true },
        });
        expect(prismaMock.userVocabState.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: {
                isFavorite: true,
                favoritedAt: expect.any(Date),
            },
            create: expect.objectContaining({
                status: 'ACTIVE',
                isFavorite: true,
                favoritedAt: expect.any(Date),
            }),
        }));
    });

    it('returns validation errors for invalid vocab ids', async () => {
        const { markVocabMastered } = await import('../vocab-actions');

        const result = await markVocabMastered(0);

        expect(result.status).toBe('error');
        expect(prismaMock.userVocabState.upsert).not.toHaveBeenCalled();
    });

    it('does not expose raw backend errors when mark mastered fails', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        prismaMock.$transaction.mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`userId`,`vocabId`)'));
        const { markVocabMastered } = await import('../vocab-actions');

        try {
            const result = await markVocabMastered(42);

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(result).toMatchObject({
                status: 'error',
                message: '设置失败，请稍后再试',
            });
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('resets FSRS and clears word-level MASTERED while preserving favorite fields', async () => {
        const { resetVocabProgress } = await import('../vocab-actions');

        await resetVocabProgress(42);

        expect(prismaMock.$transaction).toHaveBeenCalled();
        expect(prismaMock.userProgress.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: 'user-1', vocabId: 42 },
            data: expect.objectContaining({
                status: 'NEW',
                stability: 0,
                difficulty: 0,
                reps: 0,
                lapses: 0,
            }),
        }));
        expect(prismaMock.userVocabState.updateMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', vocabId: 42 },
            data: {
                status: 'ACTIVE',
                masteredAt: null,
            },
        });
    });

    it('returns unauthorized when no user is signed in', async () => {
        authMock.mockResolvedValue(null);
        const { toggleVocabFavorite } = await import('../vocab-actions');

        const result = await toggleVocabFavorite(42, true);

        expect(result).toMatchObject({
            status: 'error',
            message: 'Unauthorized',
        });
        expect(prismaMock.userVocabState.upsert).not.toHaveBeenCalled();
    });
});
