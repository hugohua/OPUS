/**
 * Audio Session Action
 * 功能：
 *   获取 L1 Audio Gym 的训练队列
 * 逻辑：
 *   1. 筛选: userId, track=AUDIO, status=[LEARNING, REVIEW], next_review_at <= NOW
 *   2. 排序: frequency_score DESC (生存优先) -> next_review_at ASC (逾期优先)
 *   3. 返回: 单词信息 + 音色配置
 */
'use server';

import { auth } from '@/auth';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { redirect } from 'next/navigation';
import { recordOutcome } from './record-outcome';
import {
    getAudioSessionForUser,
    SubmitAudioGradeSchema,
    type AudioSessionData,
    type SubmitAudioGradeInput,
} from '@/lib/session/audio';

const log = createLogger('actions:audio-session');

/**
 * 获取 Audio 训练队列
 */
export async function getAudioSession(userIdOverride?: string): Promise<ActionState<AudioSessionData>> {
    try {
        const session = userIdOverride ? null : await auth();
        const userId = userIdOverride ?? session?.user?.id;
        if (!userId) {
            redirect('/login');
        }
        const data = await getAudioSessionForUser(userId);

        if (data.items.length === 0) {
            return {
                status: 'success',
                message: 'No items due for review',
                data
            };
        }

        return {
            status: 'success',
            message: 'Session generated',
            data
        };

    } catch (error: any) {
        log.error({ error }, 'Failed to get audio session');
        return {
            status: 'error',
            message: 'Failed to generate session'
        };
    }
}

export async function submitAudioGrade(
    input: SubmitAudioGradeInput
): Promise<ActionState<any>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            redirect('/login');
        }

        const userId = session.user.id;

        // 直接复用 recordOutcome，track 会自动映射为 AUDIO
        return await recordOutcome({
            userId,
            vocabId: input.vocabId,
            grade: input.grade,
            mode: 'AUDIO', // 关键：指定 mode 为 AUDIO
            duration: input.duration,
        });

    } catch (error: any) {
        log.error({ error }, 'Failed to submit audio grade');
        return {
            status: 'error',
            message: error.message || 'Failed to submit grade'
        };
    }
}
