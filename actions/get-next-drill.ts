'use server';

/**
 * Session Drill 批量获取 Web Action
 * 功能：
 *   保留 Web 端 Server Action 公共接口，实际组卡逻辑委托给后端共享核心。
 */
import { getSessionDrillBatchForUser } from '@/lib/backend-core/session/batch';
import type { ActionState } from '@/types/action';
import type { BriefingPayload } from '@/types/briefing';
import type { GetBriefingInput } from '@/lib/validations/briefing';

export async function getNextDrillBatch(
    input: GetBriefingInput
): Promise<ActionState<BriefingPayload[]>> {
    return getSessionDrillBatchForUser(input);
}
