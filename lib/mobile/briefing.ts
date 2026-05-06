import {
    deleteBriefingArticleForUser,
    getBriefingDetailForUser,
    getBriefingHistoryForUser,
    getLatestBriefingForUser,
    type BriefingHistoryFilters,
} from "@/lib/backend-core/weaver/articles";
import { getWeaverIngredientsForUser } from "@/lib/backend-core/weaver/selection";
import { createWandAnalyzeStreamJob, lookupWandWord } from "@/lib/backend-core/weaver/wand";
import { WEAVER_DENSITY_IDS } from "@/lib/constants/weaver-density";
import { WEAVER_SCENARIOS } from "@/lib/constants/weaver-scenarios";

export async function getMobileLatestBriefing(userId: string) {
    return getLatestBriefingForUser(userId);
}

export async function getMobileBriefingDetail(userId: string, id: string) {
    return getBriefingDetailForUser(userId, id);
}

export async function getMobileBriefingIngredients(userId: string, scenario: string, forceRefresh = false) {
    const result = await getWeaverIngredientsForUser(userId, scenario, forceRefresh);
    if (result.status !== "success" || !result.data) {
        throw new Error(result.message || "Failed to load ingredients");
    }

    return {
        scenario,
        priorityWords: result.data.priorityWords,
        fillerWords: result.data.fillerWords,
        availableScenarios: WEAVER_SCENARIOS.map((scenarioOption) => scenarioOption.id),
        availableDensities: WEAVER_DENSITY_IDS,
    };
}

export async function getMobileBriefingHistory(userId: string, filters: BriefingHistoryFilters = {}) {
    return getBriefingHistoryForUser(userId, filters);
}

export async function getMobileBriefingWandWord(word: string) {
    return lookupWandWord(word);
}

export async function deleteMobileBriefingArticle(userId: string, id: string) {
    return deleteBriefingArticleForUser(userId, id);
}

export function createMobileBriefingWandAnalyzeStream(input: {
    text: string;
    type: "word" | "sentence";
    context?: string;
}) {
    return createWandAnalyzeStreamJob(input);
}
