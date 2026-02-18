'use server';

import { auth } from "@/auth";
import { getVectorOptimizedAnchor } from "@/lib/services/anchor-engine";

export async function getWeaverAnchor(targetId: number) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const result = await getVectorOptimizedAnchor(targetId, session.user.id);
    return result;
}

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getWeaverHistory(
    filterContext?: string,
    filterStatus?: 'new' | 'archived'
) {
    const session = await auth();
    if (!session?.user?.id) return [];

    const where: any = { userId: session.user.id };

    // Filter by Context (Scenario)
    if (filterContext) {
        // Try filtering by JSON path (Postgres only) or Title fallback
        // Since we have legacy data, we might need OR condition if we support both
        // For simplicity and performance, let's filter in memory or assume title prefix still works for legacy
        // For new system, we rely on the implementation below.

        // Actually, prisma generic JSON filtering is limited. 
        // Let's stick to title prefix for legacy compatibility? 
        // User request: "scenario selection of 6 major classes".
        // If we strictly filter by `body.context.scenarioId`, legacy articles won't show up.
        // Let's keep `startsWith` title check as it usually contains the English ID or mapped text.
        // BUT, `filterContext` from UI will be the ID (e.g. 'finance').
        // Legacy titles are like "finance - ...". So title.startsWith(filterContext) works!
        // New articles: title might NOT start with scenario ID if LLM changes it.
        // Let's check `body` AND `title`.
        where.OR = [
            { title: { startsWith: filterContext } },
            { body: { path: ['context', 'scenarioId'], equals: filterContext } }
        ];
    }

    // Filter by Status (Visual New = < 24h)
    if (filterStatus) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (filterStatus === 'new') {
            where.createdAt = { gte: twentyFourHoursAgo };
        } else if (filterStatus === 'archived') {
            where.createdAt = { lt: twentyFourHoursAgo };
        }
    }

    const articles = await prisma.article.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            createdAt: true,
            body: true, // Fetch body to get context
            // Include minimal vocab info for preview
            vocabs: {
                take: 5,
                select: {
                    vocab: { select: { word: true } }
                }
            }
        },
        take: 50 // Increased limit for better filtering experience
    });

    return articles.map(a => {
        // Safe cast body
        const body = a.body as any;
        const storedScenarioId = body?.context?.scenarioId;

        return {
            ...a,
            // Use stored ID if available, otherwise fallback to title prefix (legacy)
            scenario: storedScenarioId || a.title.split('-')[0].trim(),
            vocabPreview: a.vocabs.map(v => v.vocab.word).join(', ')
        };
    });
}

import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

export async function getWeaverContexts() {
    const session = await auth();
    if (!session?.user?.id) return [];

    // Return the fixed list of scenarios for now to ensure UI consistency
    // Optimization: In future, we can count distinct articles per scenario to disable empty filters
    return WEAVER_SCENARIOS.map(s => s.id);
}

export async function deleteWeaverArticle(id: string) {
    console.log(`[deleteWeaverArticle] Attempting to delete article: ${id}`);
    const session = await auth();

    if (!session?.user?.id) {
        console.error("[deleteWeaverArticle] Unauthorized: No user session");
        throw new Error("Unauthorized");
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete associated ArticleVocab records first
            await tx.articleVocab.deleteMany({
                where: { articleId: id }
            });

            // 2. Delete the article
            await tx.article.delete({
                where: { id, userId: session.user.id }
            });
        });
        console.log(`[deleteWeaverArticle] Successfully deleted article: ${id}`);
    } catch (error) {
        console.error(`[deleteWeaverArticle] Failed to delete article: ${id}`, error);
        throw error;
    }

    revalidatePath('/weaver/history');
    return { success: true };
}

/**
 * 轻量级查询：仅获取最新一篇简报（Dashboard 专用）
 * 避免 getWeaverHistory 的全量 body + vocabs 查询开销
 */
export async function getLatestBriefing() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const article = await prisma.article.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            createdAt: true,
            body: true // 仅用于提取 scenarioId
        }
    });

    if (!article) return null;

    const body = article.body as any;
    const scenarioId = body?.context?.scenarioId || article.title.split('-')[0].trim();

    return {
        id: article.id,
        title: article.title,
        createdAt: article.createdAt,
        scenario: scenarioId
    };
}
