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
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { recordOutcome } from './record-outcome';

const log = createLogger('actions:audio-session');

// Audio Session Item Schema
export const AudioSessionItemSchema = z.object({
    id: z.string(),
    vocabId: z.number(),
    word: z.string(),
    phonetic: z.string().optional(),
    definition: z.string().optional(),
    voice: z.string().default('Cherry'), // 从 confusionAudio 或默认
});

export type AudioSessionItem = z.infer<typeof AudioSessionItemSchema>;

export const AudioSessionDataSchema = z.object({
    sessionId: z.string(),
    items: z.array(AudioSessionItemSchema),
});

export type AudioSessionData = z.infer<typeof AudioSessionDataSchema>;

/**
 * 获取 Audio 训练队列
 */
export async function getAudioSession(): Promise<ActionState<AudioSessionData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            redirect('/login');
        }

        const userId = session.user.id;
        const now = new Date();

        // 1. Fetch Candidates (Track = AUDIO)
        const candidates = await prisma.userProgress.findMany({
            where: {
                userId,
                track: 'AUDIO', // L1 Audio Track
                status: {
                    in: ['LEARNING', 'REVIEW', 'NEW']
                },
                next_review_at: { lte: now }
            },
            include: {
                vocab: {
                    select: {
                        id: true,
                        word: true,
                        phoneticUk: true,
                        phoneticUs: true,
                        definition_cn: true,
                        frequency_score: true,
                    }
                }
            },
            orderBy: [
                { vocab: { frequency_score: 'desc' } }, // 热词优先
                { next_review_at: 'asc' },              // 逾期优先
            ],
            take: 20
        });

        if (candidates.length === 0) {
            return {
                status: 'success',
                message: 'No items due for review',
                data: {
                    sessionId: crypto.randomUUID(),
                    items: []
                }
            };
        }

        // 2. Transform to Session Items
        const items: AudioSessionItem[] = candidates.map(p => ({
            id: p.id,
            vocabId: p.vocab.id,
            word: p.vocab.word,
            phonetic: p.vocab.phoneticUs || p.vocab.phoneticUk || undefined,
            definition: p.vocab.definition_cn || undefined,
            voice: 'Cherry', // TODO: 可以根据单词特性选择不同音色
        }));

        return {
            status: 'success',
            message: 'Session generated',
            data: {
                sessionId: crypto.randomUUID(),
                items
            }
        };

    } catch (error: any) {
        log.error({ error }, 'Failed to get audio session');
        return {
            status: 'error',
            message: 'Failed to generate session'
        };
    }
}

/**
 * 提交 Audio 评分
 * 简化版：直接调用 recordOutcome，mode = 'AUDIO'
 */
export const SubmitAudioGradeSchema = z.object({
    vocabId: z.number(),
    grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), // FSRS Rating
    duration: z.number().optional(), // 答题耗时 (ms)
});

export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;

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
