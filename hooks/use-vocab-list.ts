'use client';

import { useInfiniteQuery } from "@tanstack/react-query";
import { getVocabList } from "@/actions/get-vocab-list";
import type { VocabFilterStatus, VocabSortOption } from "@/lib/backend-core/vocabulary/list";

export function useVocabList(
    search: string,
    status: VocabFilterStatus,
    sort: VocabSortOption,
    tagFilter?: string
) {
    return useInfiniteQuery({
        queryKey: ['vocab-list', search, status, sort, tagFilter],
        queryFn: async ({ pageParam = 1 }) => {
            return getVocabList({
                page: pageParam,
                limit: 50,
                search,
                status,
                sort,
                tagFilter
            });
        },
        getNextPageParam: (lastPage) => {
            return lastPage.metadata.hasMore ? lastPage.metadata.page + 1 : undefined;
        },
        initialPageParam: 1,
        staleTime: 60 * 1000,
    });
}
