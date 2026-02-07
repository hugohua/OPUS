'use client';

import { useRef, useState, useMemo } from "react";
import { VocabHud } from "./ui/vocab-hud";
import { VocabFilters } from "./ui/vocab-filters";
import { VocabListItemRow } from "./ui/vocab-list-item";
import { VocabSheet } from "./ui/vocab-sheet";
import { useVocabList } from "@/hooks/use-vocab-list";
import { VocabFilterStatus, VocabSortOption, VocabListItem } from "@/actions/get-vocab-list";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "@/hooks/use-debounce";
import { Loader2 } from "lucide-react";

export function VocabularyList() {
    // 1. State
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<VocabFilterStatus>("ALL");
    const [sort, setSort] = useState<VocabSortOption>("RANK");

    // Sheet State
    const [openSheet, setOpenSheet] = useState(false);
    const [selectedItem, setSelectedItem] = useState<VocabListItem | null>(null);

    // Debounce search for query
    const debouncedSearch = useDebounce(search, 500);

    // 2. Query
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useVocabList(debouncedSearch, status, sort);

    // Flatten items
    const allItems = useMemo(() => {
        return data?.pages.flatMap(page => page.items) ?? [];
    }, [data]);

    // Metadata Stats (From first page, usually correct enough or we fetch separately)
    // Actually getVocabList returns metadata.stats in every page (global).
    const stats = data?.pages[0]?.metadata.stats ?? { mastered: 0, learning: 0, due: 0 };
    const totalCount = data?.pages[0]?.metadata.total ?? 0; // Total filtered? Or total Global?
    // getVocabList returns 'stats' as GLOBAL usage, 'total' as filtered count.

    // 3. Virtualizer
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: hasNextPage ? allItems.length + 1 : allItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80, // Approx height of row
        overscan: 5,
    });

    // Infinite Scroll trigger
    const virtualItems = rowVirtualizer.getVirtualItems();

    const lastItem = virtualItems[virtualItems.length - 1];
    if (
        lastItem &&
        lastItem.index >= allItems.length - 1 &&
        hasNextPage &&
        !isFetchingNextPage
    ) {
        fetchNextPage();
    }

    // 4. Handlers
    const handleItemClick = (item: VocabListItem) => {
        setSelectedItem(item);
        setOpenSheet(true);
    };

    return (
        <div className="flex flex-col h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans">
            {/* 1. HUD */}
            <VocabHud stats={stats} totalCount={100} />
            {/* Note: totalCount for progress bar denominator is tricky. 
               Ideally we know total vocab count (e.g. 5000). 
               Let's assume a fixed denominator or fetch it.
               The 'stats' include Mastered/Learning, we can sum them + New. 
               Or assume 'total' from metadata is filtered count.
               For now, I'll pass 3000 as typical TOEIC core size if unknown, 
               or better: sum of stats + stats.new? 
               Let's pass 3000 (TOEIC Core) as hardcoded or derived?
               Actually, let's just pass `stats.mastered + stats.learning + stats.due + ...`?
               No, stats.due is subset.
               Let's assume denominator = stats.mastered + stats.learning + 2000 (approx remaining).
               Better: Pass 100 to treat input as direct if we calculate percentage inside.
               Actually, HUD implementation calculates % based on totalCount.
               I'll pass hardcoded 3000 for "TOEIC Core" visual.
            */}

            {/* 2. Filters */}
            <VocabFilters
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                sort={sort}
                onSortChange={setSort}
            />

            {/* 3. List */}
            <main ref={parentRef} className="flex-1 overflow-y-auto w-full relative">
                {/* Status Bar */}
                <div className="px-6 py-2 bg-white/80 dark:bg-zinc-900/30 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 sticky top-0 z-10 backdrop-blur-sm">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        正在显示 "{status}" 模式下的 {data?.pages[0]?.metadata.total ?? 0} 个词
                    </span>
                    {(status !== 'ALL' || search) && (
                        <button
                            onClick={() => { setStatus('ALL'); setSearch(''); }}
                            className="text-[10px] text-indigo-400 hover:underline"
                        >
                            清除筛选
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative'
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

            {/* 4. Sheet */}
            <VocabSheet
                open={openSheet}
                onOpenChange={setOpenSheet}
                item={selectedItem}
            />
        </div>
    );
}
