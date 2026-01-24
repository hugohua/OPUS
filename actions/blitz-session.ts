'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export type BlitzBatchItem = {
    id: number;
    word: string;
    phrase: string;
    trans: string;
    target: string;
};

export type BlitzSessionState = {
    status: 'success' | 'error';
    message: string;
    data?: BlitzBatchItem[];
};

/**
 * 获取 Phrase Blitz 练习批次
 * 规则：
 * 1. 范围: Learning/Review 状态的单词
 * 2. 必须有 collocations
 * 3. 优先级: 遗忘次数(lapses) > 核心词(CORE)
 * 4. 数量: 10
 */
export async function getBlitzBatch(): Promise<BlitzSessionState> {
    const session = await auth();
    if (!session?.user?.id) {
        return { status: 'error', message: 'Unauthorized' };
    }

    const userId = session.user.id;

    try {
        // 1. 查询符合条件的 UserProgress
        // 由于 collocations 是 JSON 类型，Prisma 对 JSON 过滤支持有限，
        // 我们主要依靠 status 筛选，然后 fetch 关联的 Vocab 进行内存过滤或尽可能用 raw query
        // 这里使用 Prisma check: collocations not equals DbNull

        // 抢救队列 + 复习队列
        const candidates = await prisma.userProgress.findMany({
            where: {
                userId,
                status: {
                    in: ['LEARNING', 'REVIEW'],
                },
                vocab: {
                    collocations: {
                        not: Prisma.DbNull,
                    },
                },
            },
            include: {
                vocab: {
                    select: {
                        id: true,
                        word: true,
                        collocations: true,
                        definition_cn: true,
                        priority: true,
                    },
                },
            },
            orderBy: [
                { lapses: 'desc' },
                { vocab: { is_toeic_core: 'desc' } }, // 假设 is_toeic_core 映射到 priority, 或直接用 database field
            ],
            take: 50, //除此之外多取一些以防 collocations 实际上是空数组
        });

        const batch: BlitzBatchItem[] = [];

        for (const p of candidates) {
            if (batch.length >= 10) break;

            const v = p.vocab;
            if (!v.collocations || !Array.isArray(v.collocations) || v.collocations.length === 0) {
                continue;
            }

            // 选择第一个 collocation
            // collocations 结构假设: [{text: '...', trans: '...'}, ...]
            // 需要类型断言
            const collys = v.collocations as any[];
            const firstColly = collys[0];

            if (!firstColly || !firstColly.text) continue;

            batch.push({
                id: v.id,
                word: v.word,
                target: v.word,
                phrase: firstColly.text,
                trans: firstColly.trans || v.definition_cn || 'No translation', // Fallback
            });
        }

        // Shuffle batch
        const shuffled = batch.sort(() => Math.random() - 0.5);

        return {
            status: 'success',
            message: 'Batch fetched',
            data: shuffled,
        };
    } catch (error) {
        console.error('getBlitzBatch Error:', error);
        return { status: 'error', message: 'Failed to fetch blitz batch' };
    }
}
