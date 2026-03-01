'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { ActionState } from '@/types/action';

const log = createLogger('actions:mistake-actions');

/**
 * 归档指定的错题 (更新状态为 RESOLVED)
 */
export async function archiveMistake(mistakeId: string): Promise<ActionState<void>> {
    const session = await auth();
    if (!session?.user?.id) {
        return {
            status: 'error',
            message: 'Unauthorized',
        };
    }

    try {
        const userId = session.user.id;

        // Verify ownership and existence
        const existing = await prisma.userMistakeBook.findUnique({
            where: { id: mistakeId, userId },
        });

        if (!existing) {
            log.warn({ userId, mistakeId }, 'Attempted to archive non-existent or foreign mistake');
            return {
                status: 'error',
                message: 'Mistake not found',
            };
        }

        // Update status to RESOLVED
        await prisma.userMistakeBook.update({
            where: { id: mistakeId },
            data: { status: 'RESOLVED' },
        });

        log.info({ userId, mistakeId }, 'Successfully archived mistake');

        // Revalidate the mistakes list page to reflect the removal
        revalidatePath('/dashboard/profile/mistakes');

        return {
            status: 'success',
            message: 'Mistake archived successfully',
        };
    } catch (error) {
        log.error({ mistakeId, error }, 'Failed to archive mistake');
        return {
            status: 'error',
            message: 'An internal error occurred while trying to archive the mistake.',
        };
    }
}
