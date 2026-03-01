'use client';

import { useRef, useState, useMemo, useEffect } from "react";
import { VocabHud } from "./ui/vocab-hud";
import { VocabFilters } from "./ui/vocab-filters";
import { VocabListItemRow } from "./ui/vocab-list-item";
import { VocabSheet } from "./ui/vocab-sheet";
import { useVocabList } from "@/hooks/use-vocab-list";
import { VocabFilterStatus, VocabSortOption, VocabListItem } from "@/actions/get-vocab-list";
import { getUserAllTags } from "@/actions/vocab-actions";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";

export function VocabularyList({
    initialTags = []
}: {
    initialTags?: string[];
}) {
    // 1. 筛选状态
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<VocabFilterStatus>("ALL");
    const [sort, setSort] = useState<VocabSortOption>("RANK");
    const [tagFilter, setTagFilter] = useState<string>("");

    const [userTags, setUserTags] = useState<string[]>(initialTags);

    // Sheet 状态
    const [openSheet, setOpenSheet] = useState(false);
    const [selectedItem, setSelectedItem] = useState<VocabListItem | null>(null);

    // 搜索防抖，500ms 后才触发查询
    const debouncedSearch = useDebounce(search, 500);

    // 2. 数据查询 (注入 tagFilter)
    // 注意: useVocabList 是一个 client hook (SWR/React Query 等)，也需要适配形参
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useVocabList(debouncedSearch, status, sort, tagFilter);

    // 展开所有分页数据
    const allItems = useMemo(() => {
        return data?.pages.flatMap(page => page.items) ?? [];
    }, [data]);

    // 全局统计（每页都携带相同数据，取首页即可）
    const stats = data?.pages[0]?.metadata.stats ?? { mastered: 0, learning: 0, due: 0, totalVocab: 0 };

    // 3. 虚拟列表 — 滚动容器是 main
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: hasNextPage ? allItems.length + 1 : allItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 5,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const lastItem = virtualItems[virtualItems.length - 1];

    // 无限滚动触发 — 放在 useEffect 内，避免在渲染阶段直接执行副作用（B1 修复）
    useEffect(() => {
        if (
            lastItem &&
            lastItem.index >= allItems.length - 1 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
    }, [lastItem?.index, allItems.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // 4. 事件处理
    const handleItemClick = (item: VocabListItem) => {
        setSelectedItem(item);
        setOpenSheet(true);
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans pt-[env(safe-area-inset-top)]">
            {/*
             * 单一滚动容器（main）
             * ─ VocabHud         : 页面顶部，随内容滚动
             * ─ sticky 吸顶块    : VocabFilters + Status Bar，position:sticky top-0
             * ─ 虚拟列表         : @tanstack/react-virtual 绝对定位渲染
             */}

            <main ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide w-full relative pb-24">

                {/* ① HUD — 独立作为页面全局头部 */}
                <VocabHud stats={stats} totalCount={stats.totalVocab} />

                {/* ② 筛选栏 + 状态栏 — CSS sticky 吸顶，零 JS 开销 */}
                <div className="sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-950 shadow-sm shadow-black/5 dark:shadow-white/5 border-b border-border">
                    <VocabFilters
                        search={search}
                        onSearchChange={setSearch}
                        status={status}
                        onStatusChange={setStatus}
                        sort={sort}
                        onSortChange={setSort}
                        userTags={userTags}
                        tagFilter={tagFilter}
                        onTagFilterChange={setTagFilter}
                    />

                    {/* 状态栏：显示当前筛选结果数量 */}
                    <div className="px-6 py-2 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            正在显示 "{status === 'TAGGED' ? tagFilter : status}" 模式下的 {data?.pages[0]?.metadata.total ?? 0} 个词
                        </span>
                        {(status !== 'ALL' || search || tagFilter) && (
                            <button
                                onClick={() => { setStatus('ALL'); setSearch(''); setTagFilter(''); }}
                                className="text-[10px] text-indigo-400 hover:underline"
                            >
                                清除筛选
                            </button>
                        )}
                    </div>
                </div>

                {/* ③ 虚拟列表 */}
                {isLoading ? (
                    <div className="space-y-0">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-start justify-between p-3.5 border-b border-zinc-100 dark:border-white/5">
                                <div className="flex-1 flex flex-col gap-2 pl-3">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-4 w-10 rounded" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3.5 w-8 rounded" />
                                        <Skeleton className="h-3.5 w-32" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 ml-4">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualItems.map((virtualRow) => {
                            const isLoaderRow = virtualRow.index > allItems.length - 1;
                            const item = allItems[virtualRow.index];

                            return (
                                <div
                                    key={virtualRow.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    {isLoaderRow ? (
                                        <div className="flex items-center justify-center h-full text-xs text-zinc-600 font-mono">
                                            {hasNextPage ? '加载中...' : '已加载全部'}
                                        </div>
                                    ) : (
                                        <VocabListItemRow
                                            item={item}
                                            style={{}}
                                            onClick={() => handleItemClick(item)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ④ 词汇详情 Sheet */}
            <VocabSheet
                open={openSheet}
                onOpenChange={setOpenSheet}
                item={selectedItem}
            />
        </div>
    );
}
