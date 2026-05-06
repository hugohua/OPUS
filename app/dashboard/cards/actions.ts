/**
 * Cards 页面 Server Actions
 *
 * 功能：
 *   鉴权后委托后端共享核心获取复习卡片，避免 app/action 层承载可复用业务。
 */
'use server';

import { auth } from "@/auth";
import { getReviewCardsForUser } from "@/lib/backend-core/session/review-cards";
import { type WordAsset } from "@/types/word";

export async function getReviewCards(
    limit = 20,
    excludeIds: number[] = [],
    userIdOverride?: string
): Promise<WordAsset[]> {
    const session = userIdOverride ? null : await auth();
    const userId = userIdOverride ?? session?.user?.id;
    if (!userId) return [];

    return getReviewCardsForUser(userId, limit, excludeIds);
}
