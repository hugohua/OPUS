/**
 * Cards 页面 Server Actions
 * 
 * 功能：
 *   从 OMPS 引擎获取复习卡片数据，转换为前端 WordAsset 格式。
 *   支持 excludeIds 防止批次间重复。
 */
'use server';

import { auth } from '@/auth';
import { fetchOMPSCandidates, OMPSCandidate } from '@/lib/services/omps-core';
import { WordAsset } from '@/types/word';
import { z } from 'zod';

// 输入校验
const GetReviewCardsSchema = z.object({
    limit: z.number().min(1).max(50).default(20),
    excludeIds: z.array(z.number()).max(200).default([]),
});

/**
 * OMPSCandidate → WordAsset 转换器
 */
function toWordAsset(c: OMPSCandidate): WordAsset {
    const collocations = Array.isArray(c.collocations)
        ? c.collocations.map((col: any) => ({
            text: col.text || '',
            translation: col.trans || col.translation || undefined,
        }))
        : [];

    return {
        id: c.vocabId,
        word: c.word,
        phonetic: c.phoneticUs || c.phoneticUk || undefined,
        meaning: c.definition_cn || '',
        word_family: c.word_family || undefined,
        collocations,
    };
}

/**
 * 获取复习卡片
 * 
 * @param limit 每批数量 (默认 20，上限 50)
 * @param excludeIds 排除的词汇 ID (防止批次间重复，上限 200)
 */
export async function getReviewCards(
    limit: number = 20,
    excludeIds: number[] = []
): Promise<WordAsset[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    // Zod 校验输入
    const validated = GetReviewCardsSchema.parse({ limit, excludeIds });

    const candidates = await fetchOMPSCandidates(
        session.user.id,
        validated.limit,
        {},
        validated.excludeIds
    );

    return candidates.map(toWordAsset);
}
