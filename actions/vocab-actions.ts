'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

/**
 * Suspend a vocab (mark as Mastered/Ignored)
 * Temporarily maps to MASTERED status until we have a proper SUSPENDED state.
 */
export async function suspendVocab(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    // Reset all tracks to NEW
    await prisma.userProgress.updateMany({
        where: {
            userId,
            vocabId,
        },
        data: {
            status: 'MASTERED', // Semantically "Finalized" for now
            next_review_at: null, // Remove from schedule
        }
    });

    revalidatePath('/dashboard');
}

/**
 * Reset FSRS progress for a vocab (Factory Reset)
 */
export async function resetVocabProgress(vocabId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;

    await prisma.userProgress.updateMany({
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

    console.log(`[VOCAB_ACTION] User ${userId} reset progress for Vocab ${vocabId}`);
    revalidatePath('/dashboard');
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
