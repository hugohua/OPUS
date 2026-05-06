import { db } from "@/lib/db";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

export type BriefingHistoryFilters = {
    scenario?: string;
    status?: "new" | "archived";
};

type ArticleBody = {
    content?: string;
    context?: {
        scenarioId?: string;
        density?: string;
    };
} | null;

export async function getLatestBriefingForUser(userId: string) {
    const article = await db.article.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            title: true,
            createdAt: true,
            body: true,
        },
    });

    if (!article) return null;

    const body = article.body as ArticleBody;
    return {
        id: article.id,
        title: article.title,
        createdAt: article.createdAt.toISOString(),
        scenario: body?.context?.scenarioId ?? "general",
        density: body?.context?.density ?? "balanced",
        content: typeof body?.content === "string" ? body.content : "",
    };
}

export async function getBriefingDetailForUser(userId: string, id: string) {
    const article = await db.article.findFirst({
        where: { id, userId },
        select: {
            id: true,
            title: true,
            createdAt: true,
            summaryZh: true,
            body: true,
            vocabs: {
                select: {
                    vocab: {
                        select: {
                            id: true,
                            word: true,
                            definition_cn: true,
                        },
                    },
                },
            },
        },
    });

    if (!article) return null;

    const body = article.body as ArticleBody;
    return {
        id: article.id,
        title: article.title,
        createdAt: article.createdAt.toISOString(),
        summaryZh: article.summaryZh ?? "",
        scenario: body?.context?.scenarioId ?? "general",
        density: body?.context?.density ?? "balanced",
        content: typeof body?.content === "string" ? body.content : "",
        targetWords: article.vocabs.map(({ vocab }) => ({
            id: vocab.id,
            word: vocab.word,
            meaning: vocab.definition_cn ?? "",
        })),
    };
}

export async function getBriefingHistoryForUser(userId: string, filters: BriefingHistoryFilters = {}) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where: {
        userId: string;
        createdAt?: { gte?: Date; lt?: Date };
        OR?: Array<Record<string, unknown>>;
    } = { userId };

    if (filters.status === "new") {
        where.createdAt = { gte: twentyFourHoursAgo };
    } else if (filters.status === "archived") {
        where.createdAt = { lt: twentyFourHoursAgo };
    }

    if (filters.scenario) {
        where.OR = [
            { body: { path: ["context", "scenarioId"], equals: filters.scenario } },
            { title: { startsWith: filters.scenario } },
        ];
    }

    const articles = await db.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            title: true,
            createdAt: true,
            body: true,
            vocabs: {
                take: 5,
                select: {
                    vocab: {
                        select: {
                            word: true,
                        },
                    },
                },
            },
        },
    });

    return {
        items: articles.map((article) => {
            const body = article.body as { context?: { scenarioId?: string } } | null;
            const scenario = body?.context?.scenarioId ?? article.title.split("-")[0]?.trim() ?? "general";
            const status = article.createdAt >= twentyFourHoursAgo ? "new" : "archived";

            return {
                id: article.id,
                title: article.title,
                createdAt: article.createdAt.toISOString(),
                scenario,
                status,
                vocabPreview: article.vocabs.map(({ vocab }) => vocab.word).join(", "),
            };
        }),
        availableScenarios: WEAVER_SCENARIOS.map((scenario) => scenario.id),
    };
}

export async function deleteBriefingArticleForUser(userId: string, id: string) {
    const article = await db.article.findFirst({
        where: { id, userId },
        select: { id: true },
    });

    if (!article) return null;

    await db.$transaction(async (tx) => {
        await tx.articleVocab.deleteMany({
            where: { articleId: id },
        });
        await tx.article.delete({
            where: { id },
        });
    });

    return { success: true };
}
