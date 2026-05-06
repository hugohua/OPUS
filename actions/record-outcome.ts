'use server';

/**
 * Session Outcome Web Action
 * 功能：
 *   负责 Web 端认证、用户一致性校验和 ActionState 包装，FSRS 业务规则由共享核心处理。
 */
import { auth } from '@/auth';
import { createLogger } from '@/lib/logger';
import { recordSessionOutcomeForUser } from '@/lib/backend-core/session/outcome';
import { ActionState } from '@/types/action';
import { RecordOutcomeSchema, RecordOutcomeInput } from '@/lib/validations/briefing';

const log = createLogger('actions:record-outcome');

export async function recordOutcome(
    input: RecordOutcomeInput
): Promise<ActionState<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { status: 'error', message: 'Unauthorized' };
        }

        const { userId, ...outcomeInput } = RecordOutcomeSchema.parse(input);

        if (session.user.id !== userId) {
            log.warn({ sessionUser: session.user.id, inputUser: userId }, 'Security Alert: User mismatch in recordOutcome');
            return { status: 'error', message: 'Forbidden: ID Mismatch' };
        }

        return recordSessionOutcomeForUser(userId, outcomeInput);
    } catch (error: any) {
        log.error({ error }, 'recordOutcome failed');
        return {
            status: 'error',
            message: error.message || 'Failed to record outcome',
        };
    }
}
