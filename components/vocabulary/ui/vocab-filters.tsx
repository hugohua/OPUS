'use client';

import { Search, ListFilter, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VocabFilterStatus, VocabSortOption } from "@/actions/get-vocab-list";
import { useEffect, useState } from "react";


// Since I don't want to create a separate hook file just for debounce if not present,
// I'll assume the parent component handles state or I pass callbacks.
// Ideally, this component receives `onSearch` and `onFilterChange`.

interface VocabFiltersProps {
    search: string;
    onSearchChange: (val: string) => void;
    status: VocabFilterStatus;
    onStatusChange: (val: VocabFilterStatus) => void;
    sort: VocabSortOption;
    onSortChange: (val: VocabSortOption) => void;
}

export function VocabFilters({
    search,
    onSearchChange,
    status,
    onStatusChange,
    sort,
    onSortChange
}: VocabFiltersProps) {

    // We handle local state for input to avoid UI lag, but parent controls "search" prop.
    // Actually, usually parent holds the truth. If we want immediate feedback in UI but debounced fetch,
    // the parent should handle the debouncing logic before triggering fetch, 
    // OR we debounce the callback here.
    // For simplicity: Controlled input.

    return (
        <div className="shrink-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 z-10">
            {/* Top Row: Search + Sort */}
            <div className="px-6 py-3 flex items-center gap-4">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="block w-full pl-10 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-900 text-sm placeholder-zinc-400 dark:placeholder-zinc-500 text-zinc-900 dark:text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all focus:outline-none"
                        placeholder="搜索单词..."
                    />
                </div>

                <button
                    onClick={() => onSortChange(sort === 'RANK' ? 'DUE' : 'RANK')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>排序: {sort === 'RANK' ? '排名' : '待复习'}</span>
                </button>
            </div>

            {/* Bottom Row: Chips */}
            <div className="px-6 pb-4 flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
                {/* Mask for scroll fade if supported, otherwise just scroll */}

                <FilterChip
                    label="全部"
                    active={status === 'ALL'}
                    onClick={() => onStatusChange('ALL')}
                    variant="default"
                />

                <FilterChip
                    label="新词"
                    active={status === 'NEW'}
                    onClick={() => onStatusChange('NEW')}
                    dotColor="bg-zinc-600"
                />

                <FilterChip
                    label="学习中"
                    active={status === 'LEARNING'}
                    onClick={() => onStatusChange('LEARNING')}
                    dotColor="bg-amber-500"
                />

                <FilterChip
                    label="待复习"
                    active={status === 'REVIEW'}
                    onClick={() => onStatusChange('REVIEW')}
                    dotColor="bg-emerald-500"
                />

                <FilterChip
                    label="难点词"
                    active={status === 'LEECH'}
                    onClick={() => onStatusChange('LEECH')}
                    variant="rose"
                    icon={<AlertCircle className="w-2.5 h-2.5" strokeWidth={3} />}
                />

                <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0"></div>

                <FilterChip
                    label="AI 情境"
                    active={status === 'CONTEXT'}
                    onClick={() => onStatusChange('CONTEXT')}
                    variant="violet"
                    icon={<Sparkles className="w-2.5 h-2.5" />}
                />
            </div>
        </div>
    );
}

// --- Sub-components ---

interface FilterChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
    variant?: 'default' | 'rose' | 'violet';
    dotColor?: string;
    icon?: React.ReactNode;
}

function FilterChip({ label, active, onClick, variant = 'default', dotColor, icon }: FilterChipProps) {
    if (label === '全部') {
        return (
            <button
                onClick={onClick}
                className={cn(
                    "shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all",
                    active
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
            >
                {label}
            </button>
        );
    }

    // Regular Chips
    const baseClass = "shrink-0 px-3 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 transition-all";

    let variantClass = "";
    if (variant === 'default') {
        variantClass = active
            ? "bg-zinc-800 text-white border-zinc-700 dark:bg-zinc-800 dark:text-white dark:border-zinc-700" // Should adapt for light mode too?
            : "bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600";
        // Active default variant needs check. Usually dark active is bg-zinc-800. Light active? Maybe bg-zinc-200?
        if (active) variantClass = "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-700";
    } else if (variant === 'rose') {
        variantClass = active
            ? "bg-rose-500/20 text-rose-400 border-rose-500/50"
            : "text-rose-400/80 hover:text-rose-400 bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/50";
    } else if (variant === 'violet') {
        variantClass = active
            ? "bg-violet-500/20 text-violet-400 border-violet-500/50"
            : "text-violet-400 hover:text-violet-300 bg-violet-500/5 border border-violet-500/10 hover:border-violet-500/40";
    }

    return (
        <button onClick={onClick} className={cn(baseClass, variantClass)}>
            {dotColor && <span className={cn("w-2 h-2 rounded-full", dotColor)} />}
            {icon}
            {label}
        </button>
    );
}
