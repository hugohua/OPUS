'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { ActionState } from '@/types/action';
import { MarkVocabMasteredSchema, ToggleVocabFavoriteSchema } from '@/lib/validations/vocab-state';

const GENERIC_VOCAB_STATE_ERROR = '设置失败，请稍后再试';
const GENERIC_FAVORITE_ERROR = '收藏失败，请稍后再试';

/**
 * Mark a vocab as user-confirmed MASTERED at word level.
 * This does not mutate any track-level FSRS rows in UserProgress.
 */
export async function markVocabMastered(vocabId: number): Promise<ActionState<void>> {
    const session = await auth();
    if (!session?.user?.id) {
        return { status: 'error', message: 'Unauthorized' };
    }

    const parsed = MarkVocabMasteredSchema.safeParse({ vocabId });
    if (!parsed.success) {
        return {
            status: 'error',
            message: 'Invalid vocab id',
            fieldErrors: { vocabId: parsed.error.issues[0]?.message ?? 'Invalid vocab id' },
        };
    }

    const userId = session.user.id;
    const now = new Date();

    try {
        await prisma.$transaction(async (tx) => {
            await tx.userVocabState.upsert({
                where: {
                    userId_vocabId: {
                        userId,
                        vocabId: parsed.data.vocabId,
                    },
                },
                update: {
                    status: 'MASTERED',
                    masteredAt: now,
                },
                create: {
                    userId,
                    vocabId: parsed.data.vocabId,
                    status: 'MASTERED',
                    masteredAt: now,
                },
            });
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/profile');
        revalidatePath('/vocabulary');
        revalidatePath('/dashboard/vocab');

        return { status: 'success', message: 'Vocab marked as mastered' };
    } catch (error) {
        console.error('[VOCAB_ACTION] markVocabMastered failed:', error);
        return {
            status: 'error',
            message: GENERIC_VOCAB_STATE_ERROR,
        };
    }
}

/**
 * Toggle the default favorite flag for a vocab.
 * Favorite is independent of MASTERED and never affects training selection.
 */
export async function toggleVocabFavorite(
    vocabId: number,
    isFavorite: boolean
): Promise<ActionState<{ isFavorite: boolean }>> {
    const session = await auth();
    if (!session?.user?.id) {
        return { status: 'error', message: 'Unauthorized' };
    }

    const parsed = ToggleVocabFavoriteSchema.safeParse({ vocabId, isFavorite });
    if (!parsed.success) {
        return {
            status: 'error',
            message: 'Invalid favorite payload',
            fieldErrors: { vocabId: parsed.error.issues[0]?.message ?? 'Invalid favorite payload' },
        };
    }

    const userId = session.user.id;
    const favoritedAt = parsed.data.isFavorite ? new Date() : null;

    try {
        await prisma.userVocabState.upsert({
            where: {
                userId_vocabId: {
                    userId,
                    vocabId: parsed.data.vocabId,
                },
            },
            update: {
                isFavorite: parsed.data.isFavorite,
                favoritedAt,
            },
            create: {
                userId,
                vocabId: parsed.data.vocabId,
                status: 'ACTIVE',
                isFavorite: parsed.data.isFavorite,
                favoritedAt,
            },
        });

        revalidatePath('/vocabulary');
        revalidatePath('/dashboard/vocab');

        return {
            status: 'success',
            message: parsed.data.isFavorite ? 'Vocab favorited' : 'Vocab unfavorited',
            data: { isFavorite: parsed.data.isFavorite },
        };
    } catch (error) {
        console.error('[VOCAB_ACTION] toggleVocabFavorite failed:', error);
        return {
            status: 'error',
            message: GENERIC_FAVORITE_ERROR,
        };
    }
}

/**
 * @deprecated Use markVocabMastered. Kept for existing UI call sites.
 */
export async function suspendVocab(vocabId: number) {
    const result = await markVocabMastered(vocabId);
    if (result.status === 'error') {
        throw new Error(result.message);
    }
}

/**
 * Reset FSRS progress for a vocab (Factory Reset)
 */
export async function resetVocabProgress(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    await prisma.$transaction(async (tx) => {
        await tx.userProgress.updateMany({
            where: {
                userId,
                vocabId,
            },
            data: {
                status: 'NEW',
                stability: 0,
                difficulty: 0,
                reps: 0,
                lapses: 0,
                state: 0, // State.New
                last_review_at: null,
                next_review_at: new Date(), // Due immediately
                interval: 0
            }
        });

        await tx.userVocabState.updateMany({
            where: {
                userId,
                vocabId,
            },
            data: {
                status: 'ACTIVE',
                masteredAt: null,
            },
        });
    });

    console.log(`[VOCAB_ACTION] User ${userId} reset progress for Vocab ${vocabId}`);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/profile');
    revalidatePath('/vocabulary');
    revalidatePath('/dashboard/vocab');
}

/**
 * Get raw data for "Inspect JSON"
 */
export async function getVocabRawData(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const vocab = await prisma.vocab.findUnique({
        where: { id: vocabId },
        include: {
            smartContent: {
                select: {
                    type: true,
                    scenario: true,
                    model: true,
                    createdAt: true
                }
            }
        }
    });

    const progress = await prisma.userProgress.findMany({
        where: {
            userId: session.user.id,
            vocabId
        }
    });

    return { vocab, progress };
}

/**
 * 提取当前用户的整个标签库字典，用于词库过滤（Phase 1）
 */
export async function getUserAllTags(): Promise<string[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    // 执行原生 JSONB 查询提取独立标签 (PostgreSQL Specific)
    // 从 masteryMatrix->'userTags' 数组中拆分出纯文本，并去重
    const rows = await prisma.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT jsonb_array_elements_text("masteryMatrix"->'userTags') as tag
        FROM "UserProgress"
        WHERE "userId" = ${session.user.id} AND "masteryMatrix" ? 'userTags'
    `;

    return rows.map(r => r.tag);
}

import { MasteryMatrixSchema } from '@/lib/validations/mastery-matrix';

/**
 * 更新用户自建标签（功能 B）
 */
export async function updateUserVocabTags(vocabId: number, tags: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    // 先验证输入 Tags
    const safeTags = MasteryMatrixSchema.pick({ userTags: true }).parse({ userTags: tags }).userTags;

    // We use transaction to fetch current, merge, then save to guarantee safety (P0 Audit fix)
    await prisma.$transaction(async (tx) => {
        // [AUDIT FIX] 行级悲观锁解决 JSONB 的并发脏写问题
        const rows = await tx.$queryRaw<{ masteryMatrix: any }[]>`
            SELECT "masteryMatrix" FROM "UserProgress"
            WHERE "userId" = ${userId} AND "vocabId" = ${vocabId} AND "track" = 'VISUAL'
            FOR UPDATE
        `;

        const currentMatrix = (rows[0]?.masteryMatrix as Record<string, any>) || {};

        // Zod enforced update
        const nextMatrix = {
            ...currentMatrix,
            userTags: safeTags
        };

        // 如果该词仍是 new，Upsert it (状态维持为 NEW)
        await tx.userProgress.upsert({
            where: { userId_vocabId_track: { userId, vocabId, track: 'VISUAL' } },
            update: { masteryMatrix: nextMatrix },
            create: {
                userId,
                vocabId,
                track: 'VISUAL',
                status: 'NEW',
                dueDate: new Date(),
                masteryMatrix: nextMatrix
            }
        });
    });

    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/vocab`);
}

/**
 * 保存用户记忆笔记（功能 A）
 */
export async function saveUserVocabNote(vocabId: number, note: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    // 结构验证截断
    const safeNote = MasteryMatrixSchema.pick({ userNote: true }).parse({ userNote: note }).userNote;

    await prisma.$transaction(async (tx) => {
        // [AUDIT FIX] 行级悲观锁解决 JSONB 的并发脏写问题
        const rows = await tx.$queryRaw<{ masteryMatrix: any }[]>`
            SELECT "masteryMatrix" FROM "UserProgress"
            WHERE "userId" = ${userId} AND "vocabId" = ${vocabId} AND "track" = 'VISUAL'
            FOR UPDATE
        `;

        const currentMatrix = (rows[0]?.masteryMatrix as Record<string, any>) || {};

        // Zod enforced update
        const nextMatrix = {
            ...currentMatrix,
            userNote: safeNote
        };

        await tx.userProgress.upsert({
            where: { userId_vocabId_track: { userId, vocabId, track: 'VISUAL' } },
            update: { masteryMatrix: nextMatrix },
            create: {
                userId,
                vocabId,
                track: 'VISUAL',
                status: 'NEW', // Keep implicit fallback state
                dueDate: new Date(),
                masteryMatrix: nextMatrix
            }
        });
    });

    // 🛑 [Blocker Fixed]: 修复缓存清理漏洞，确保刷新路由使乐观更新完全生效
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/vocab`);
}
