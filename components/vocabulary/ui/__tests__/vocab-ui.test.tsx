/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VocabListItem } from '@/actions/get-vocab-list';
import { VocabFilters } from '../vocab-filters';
import { VocabListItemRow } from '../vocab-list-item';
import { VocabSheet } from '../vocab-sheet';
import { markVocabMastered } from '@/actions/vocab-actions';
import { useQueryClient } from '@tanstack/react-query';

vi.mock('@/actions/vocab-actions', () => ({
    markVocabMastered: vi.fn().mockResolvedValue({ status: 'success' }),
}));

vi.mock('@/actions/get-vocab-detail', () => ({
    getVocabDetail: vi.fn().mockResolvedValue({
        vocab: {
            id: 42,
            word: 'asset',
            definition_cn: '资产',
            collocations: [],
        },
        progress: null,
    }),
}));

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
    return {
        ...actual,
        useQueryClient: vi.fn(),
    };
});

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/components/ui/drawer', () => ({
    Drawer: ({ open, children }: any) => open ? <div>{children}</div> : null,
    DrawerContent: ({ children }: any) => <div>{children}</div>,
    DrawerFooter: ({ children }: any) => <div>{children}</div>,
    DrawerClose: ({ children }: any) => <div>{children}</div>,
    DrawerTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/vocabulary/detail/VocabHero', () => ({
    VocabHero: ({ word }: any) => <div>{word}</div>,
}));

vi.mock('@/components/vocabulary/detail/CommonChunks', () => ({
    CommonChunks: () => <div>chunks</div>,
}));

vi.mock('next/link', () => ({
    default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

const baseItem: VocabListItem = {
    id: 42,
    word: 'asset',
    phonetic: null,
    definition: '资产',
    abceedRank: 1,
    fsrs: {
        status: 'REVIEW',
        stability: 4,
        difficulty: 5,
        retention: 88,
        nextReview: new Date(Date.now() - 1000),
        lapses: 0,
        isLeech: false,
        hasContext: false,
        contextSentence: null,
        isFavorite: false,
    },
};

describe('Vocabulary UI mastered state', () => {
    const invalidateQueries = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useQueryClient as any).mockReturnValue({ invalidateQueries });
    });

    it('shows a short mastered filter chip that switches to MASTERED status', () => {
        const onStatusChange = vi.fn();

        render(
            <VocabFilters
                search=""
                onSearchChange={vi.fn()}
                status="ALL"
                onStatusChange={onStatusChange}
                sort="RANK"
                onSortChange={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: '熟' }));

        expect(onStatusChange).toHaveBeenCalledWith('MASTERED');
    });

    it('marks mastered words with the short 熟 tag in the list row', () => {
        render(
            <VocabListItemRow
                item={{
                    ...baseItem,
                    fsrs: {
                        ...baseItem.fsrs,
                        status: 'MASTERED',
                    },
                }}
                style={{}}
                onClick={vi.fn()}
            />
        );

        expect(screen.getByText('熟')).toBeTruthy();
    });

    it('uses short Chinese tags for new and due list rows', () => {
        const { unmount } = render(
            <VocabListItemRow
                item={{
                    ...baseItem,
                    fsrs: {
                        ...baseItem.fsrs,
                        status: 'NEW',
                    },
                }}
                style={{}}
                onClick={vi.fn()}
            />
        );

        expect(screen.getByText('新')).toBeTruthy();

        unmount();

        render(
            <VocabListItemRow
                item={baseItem}
                style={{}}
                onClick={vi.fn()}
            />
        );

        expect(screen.getByText('复')).toBeTruthy();
    });

    it('invalidates vocab list queries after marking a word mastered from the sheet', async () => {
        const onOpenChange = vi.fn();

        render(
            <VocabSheet
                open
                onOpenChange={onOpenChange}
                item={baseItem}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: '标为已掌握' }));

        await waitFor(() => {
            expect(markVocabMastered).toHaveBeenCalledWith(42);
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocab-list'] });
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });
});
