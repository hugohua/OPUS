import { getVocabDetailForUser } from "@/lib/backend-core/vocabulary/detail";
import {
    getVocabListForUser,
    type VocabFilterStatus,
    type VocabSortOption,
} from "@/lib/backend-core/vocabulary/list";
import { getVocabTagsForUser } from "@/lib/backend-core/vocabulary/tags";

export async function getMobileVocabList(params: {
    userId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sort?: string;
    tagFilter?: string;
}) {
    return getVocabListForUser(params.userId, {
        page: params.page,
        limit: params.limit,
        search: params.search,
        status: (params.status as VocabFilterStatus) ?? "ALL",
        sort: (params.sort as VocabSortOption) ?? "RANK",
        tagFilter: params.tagFilter,
    });
}

export async function getMobileVocabDetail(id: string, userId: string) {
    return getVocabDetailForUser(userId, id);
}

export async function getMobileVocabTags(userId: string): Promise<string[]> {
    return getVocabTagsForUser(userId);
}
