'use client';

import { useInfiniteQuery } from "@tanstack/react-query";
import { getVocabList, VocabFilterStatus, VocabSortOption } from "@/actions/get-vocab-list";

export function useVocabList(
    search: string,
    status: VocabFilterStatus,
    sort: VocabSortOption
) {
    return useInfiniteQuery({
        queryKey: ['vocab-list', search, status, sort],
        queryFn: async ({ pageParam = 1 }) => {
            return getVocabList({
                page: pageParam,
                limit: 50,
                search,
                status,
                sort
            });
        },
        getNextPageParam: (lastPage) => {
            return lastPage.metadata.hasMore ? lastPage.metadata.page + 1 : undefined;
        },
        initialPageParam: 1,
        staleTime: 60 * 1000,
    });
}
