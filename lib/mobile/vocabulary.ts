import { getVocabDetail } from "@/actions/get-vocab-detail";
import { getVocabList } from "@/actions/get-vocab-list";
import { db } from "@/lib/db";

export async function getMobileVocabList(params: {
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort?: string;
    tagFilter?: string;
}) {
    return getVocabList({
        userIdOverride: params.userId,
        page: params.page,
        limit: params.limit,
        search: params.search,
        status: (params.status as Parameters<typeof getVocabList>[0]["status"]) ?? "ALL",
        sort: (params.sort as Parameters<typeof getVocabList>[0]["sort"]) ?? "RANK",
        tagFilter: params.tagFilter,
    });
}

export async function getMobileVocabDetail(id: string, userId: string) {
    return getVocabDetail(id, userId);
}

export async function getMobileVocabTags(userId: string): Promise<string[]> {
    const rows = await db.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT jsonb_array_elements_text("masteryMatrix"->'userTags') as tag
        FROM "UserProgress"
        WHERE "userId" = ${userId} AND "masteryMatrix" ? 'userTags'
    `;

    return rows
        .map((row) => row.tag)
        .filter((tag) => tag.length > 0)
        .sort((left, right) => left.localeCompare(right));
}
