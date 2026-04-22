import { db } from "@/lib/db";
import { getWeaverIngredients } from "@/actions/weaver-selection";
import { WEAVER_DENSITY_IDS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

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
