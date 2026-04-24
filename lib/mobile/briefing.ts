import { db } from "@/lib/db";
import { streamText } from "ai";
import { getWeaverIngredients } from "@/actions/weaver-selection";
import { ProviderRegistry } from "@/lib/ai/providers";
import { WEAVER_DENSITY_IDS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";
import { WandPrompts } from "@/lib/generators/wand-prompts";
import { WandWordOutputSchema } from "@/lib/validations/weaver-wand-schemas";

type BriefingHistoryFilters = {
    scenario?: string;
    status?: "new" | "archived";
};

export async function getMobileLatestBriefing(userId: string) {
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

    const body = article.body as { context?: { scenarioId?: string; density?: string } } | null;

    return {
        id: article.id,
        title: article.title,
        createdAt: article.createdAt.toISOString(),
        scenario: body?.context?.scenarioId ?? "general",
        density: body?.context?.density ?? "balanced",
        content: typeof (article.body as { content?: unknown } | null)?.content === "string"
            ? (article.body as { content: string }).content
            : "",
    };
}

export async function getMobileBriefingDetail(userId: string, id: string) {
    const article = await db.article.findFirst({
        where: {
            id,
            userId,
        },
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

    if (!article) {
        return null;
    }

    const body = article.body as {
        content?: string;
        context?: {
            scenarioId?: string;
            density?: string;
        };
    } | null;

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

export async function getMobileBriefingIngredients(userId: string, scenario: string, forceRefresh = false) {
    const result = await getWeaverIngredients(userId, scenario, forceRefresh, userId);
    if (result.status !== "success" || !result.data) {
        throw new Error(result.message || "Failed to load ingredients");
    }

    return {
        scenario,
        priorityWords: result.data.priorityWords,
        fillerWords: result.data.fillerWords,
        availableScenarios: WEAVER_SCENARIOS.map((scenario) => scenario.id),
        availableDensities: WEAVER_DENSITY_IDS,
    };
}

export async function getMobileBriefingHistory(userId: string, filters: BriefingHistoryFilters = {}) {
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

export async function getMobileBriefingWandWord(word: string) {
    const vocab = await db.vocab.findFirst({
        where: {
            word: {
                equals: word,
                mode: "insensitive",
            },
        },
        select: {
            id: true,
            phoneticUk: true,
            definition_cn: true,
            etymology: {
                select: {
                    mode: true,
                    memory_hook: true,
                    data: true,
                },
            },
        },
    });

    if (!vocab) {
        return null;
    }

    const response = {
        vocab: {
            phonetic: vocab.phoneticUk || "",
            meaning: vocab.definition_cn || "",
        },
        etymology: vocab.etymology ? {
            mode: vocab.etymology.mode,
            memory_hook: vocab.etymology.memory_hook,
            data: Object.fromEntries(
                Object.entries((vocab.etymology.data ?? {}) as Record<string, unknown>).map(([key, value]) => [
                    key,
                    typeof value === "string" ? value : JSON.stringify(value),
                ])
            ),
        } : null,
        ai_insight: null,
    };

    return WandWordOutputSchema.parse(response);
}

export async function deleteMobileBriefingArticle(userId: string, id: string) {
    const article = await db.article.findFirst({
        where: {
            id,
            userId,
        },
        select: {
            id: true,
        },
    });

    if (!article) {
        return null;
    }

    await db.articleVocab.deleteMany({
        where: { articleId: id },
    });
    await db.article.delete({
        where: { id },
    });

    return { success: true };
}

export function createMobileBriefingWandAnalyzeStream(input: {
    text: string;
    type: "word" | "sentence";
    context?: string;
}) {
    const promptData = input.type === "word"
        ? WandPrompts.word(input.text, input.context ?? "")
        : WandPrompts.sentence(input.text);

    const providers = ProviderRegistry.getFailoverList("fast");
    if (providers.length === 0) {
        throw new Error("No AI providers available");
    }

    const model = ProviderRegistry.createModel(providers[0]);
    const encoder = new TextEncoder();
    const result = streamText({
        model,
        system: promptData.system,
        prompt: promptData.user,
        temperature: 0.3,
    });

    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of result.textStream) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", data: chunk })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            } catch (error) {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Stream error" })}\n\n`
                    )
                );
            } finally {
                controller.close();
            }
        },
    });
}
