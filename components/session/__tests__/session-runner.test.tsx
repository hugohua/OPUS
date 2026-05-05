/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SessionRunner } from '../session-runner';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { recordOutcome } from '@/actions/record-outcome';
import { markVocabMastered } from '@/actions/vocab-actions';
import { toast } from 'sonner';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BriefingPayload } from '@/types/briefing';

// --- Mocks ---
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));
vi.mock('@/actions/get-next-drill', () => ({
    getNextDrillBatch: vi.fn()
}));
vi.mock('@/actions/record-outcome', () => ({
    recordOutcome: vi.fn().mockResolvedValue({ status: 'success' })
}));
vi.mock('@/actions/vocab-actions', () => ({
    markVocabMastered: vi.fn().mockResolvedValue({ status: 'success' })
}));
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));
vi.mock('server-only', () => ({}));
// Mock child components to simplify DOM and focus on Logic
vi.mock('@/components/drill/focus-shell', () => ({
    FocusShell: ({ children, footer, onExit, progress, rightAction }: any) => (
        <div data-testid="focus-shell" data-progress={progress}>
            <button onClick={onExit} data-testid="exit-btn">Exit</button>
            <div data-testid="right-action">{rightAction}</div>
            <div data-testid="card-body">{children}</div>
            <div data-testid="card-footer">{footer}</div>
        </div>
    )
}));
vi.mock('@/components/briefing/editorial-drill', () => ({
    EditorialDrill: () => <div data-testid="editorial-drill">Drill Content</div>
}));
vi.mock('@/components/session/blitz-session', () => ({
    BlitzSession: () => <div data-testid="blitz-session">Blitz Mode</div>
}));
vi.mock('@/components/session/session-skeleton', () => ({
    SessionSkeleton: () => <div data-testid="skeleton">Loading...</div>
}));
vi.mock('@/components/briefing/phrase-card', () => ({
    PhraseCard: () => <div data-testid="phrase-card">Phrase</div>
}));
vi.mock('@/lib/client/session-store', () => ({
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    clearSession: vi.fn()
}));
vi.mock('@/lib/utils', () => ({
    cn: (...inputs: any[]) => inputs.join(' ')
}));
// Helper to create dummy payload
const createDrills = (count: number, startId = 1): BriefingPayload[] => {
    return Array.from({ length: count }).map((_, i) => ({
        meta: {
            vocabId: startId + i,
            mode: 'SYNTAX',
            format: 'chat',
            target_word: `word${startId + i}`
        },
        segments: [
            { type: 'text', content_markdown: 'Question' },
            {
                type: 'interaction',
                task: {
                    style: 'swipe_card',
                    options: ['Option A', 'Option B'],
                    answer_key: 'Option A'
                }
            }
        ]
    } as any));
};

describe('SessionRunner Infinite Scroll', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should prefetch when remaining items <= 10', async () => {
        // Setup: Initial queue of 12 items. Threshold is 10.
        // Index 0: Remaining 12.
        // Index 1: Remaining 11.
        // Index 2: Remaining 10 -> TRIGGER.
        const initialDrills = createDrills(12);

        // Mock getNextDrillBatch to return more items
        (getNextDrillBatch as any).mockResolvedValue({
            status: 'success',
            data: createDrills(5, 100) // 5 new items
        });

        render(<SessionRunner userId="u1" mode="SYNTAX" initialPayload={initialDrills} />);

        // Screen should show first card
        expect(screen.getByTestId('focus-shell')).toBeTruthy();

        // Helper to advance one slide
        const advanceSlide = async () => {
            // Click Option A (Correct)
            const optA = screen.getByText('Option A');
            fireEvent.click(optA);

            // Wait for Next Button
            const nextBtn = await screen.findByText(/下一题/i);
            fireEvent.click(nextBtn);
        };

        // 1. Complete Drill 1 (Index 0 -> 1)
        await advanceSlide();
        // Remaining: 12 - 1 = 11. Threshold 10. Should NOT call yet.
        expect(getNextDrillBatch).not.toHaveBeenCalled();

        // 2. Complete Drill 2 (Index 1 -> 2)
        await advanceSlide();
        // Remaining: 12 - 2 = 10. Threshold 10. SHOULD TRIGGER.

        await waitFor(() => {
            expect(getNextDrillBatch).toHaveBeenCalledWith(expect.objectContaining({
                excludeVocabIds: expect.arrayContaining([1, 2])
            }));
        });
    });

    it('should requeue wrong answer immediately (Session Loop)', async () => {
        // Explicitly reset mock to return empty batch (prevent infinite scroll interference)
        (getNextDrillBatch as any).mockResolvedValue({
            status: 'success',
            data: []
        });

        // Setup: 5 drills
        const initialDrills = createDrills(5);
        render(<SessionRunner userId="u2" mode="SYNTAX" initialPayload={initialDrills} />);

        expect(screen.getByTestId('focus-shell')).toBeTruthy();

        // Answer WRONG: Click Option B (Key is A)
        const optB = screen.getByText('Option B');
        fireEvent.click(optB);

        const nextBtn = await screen.findByText(/下一题/i);
        fireEvent.click(nextBtn);

        // Verification:
        expect(recordOutcome).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'u2',
            grade: 1,
            vocabId: 1
        }));

        // To verify Requeue:
        // We check if `universal-card` progress reflects expanded queue.
        // Initial: 1/5 = 20%.
        // After wrong: Queue becomes 6. Index becomes 1. Progress: 2/6 = 33.33%.
        // If not requeued: Queue 5. Index 1. Progress: 2/5 = 40%.

        await waitFor(() => {
            const card = screen.getByTestId('focus-shell');
            const progress = parseFloat(card.getAttribute('data-progress') || '0');
            expect(progress).toBeCloseTo(33.33, 1);
        });
    });

    it('should update progress bar correctly during progression and expansion', async () => {
        // Setup: 10 drills
        const initialDrills = createDrills(10);

        // Mock getNextDrillBatch to return 10 more items when called
        (getNextDrillBatch as any).mockResolvedValue({
            status: 'success',
            data: createDrills(10, 200) // 10 new items
        });

        render(<SessionRunner userId="u3" mode="SYNTAX" initialPayload={initialDrills} />);

        const card = screen.getByTestId('focus-shell');

        // 1. Initial State
        // Infinite Scroll triggers immediately on mount (10 <= 10).
        // Queue expands to 20.
        // Progress 1(0+1)/20 = 5%. (Assuming effect ran).

        // 2. Advance one slide (Correct Answer) -> Index 1
        const optA = screen.getAllByText('Option A')[0];
        fireEvent.click(optA);
        const nextBtn = await screen.findByText(/下一题/i);
        fireEvent.click(nextBtn);

        // Wait for index update
        await waitFor(() => {
            const progress = parseFloat(card.getAttribute('data-progress') || '0');
            // Infinite Scroll triggers immediately on mount (10 <= 10).
            // Queue expands to 20.
            // Index 1 (2nd item).
            // Progress = 2 / 20 = 10%.
            expect(progress).toBeCloseTo(10, 1);
        });
    });

    it('should show 熟 for anchored drills and optimistically remove the mastered vocab', async () => {
        (getNextDrillBatch as any).mockResolvedValue({
            status: 'success',
            data: []
        });
        const first = createDrills(1, 1)[0];
        const second = createDrills(1, 2)[0];
        const duplicateFirst = createDrills(1, 1)[0];

        render(<SessionRunner userId="u4" mode="SYNTAX" initialPayload={[first, second, duplicateFirst]} />);

        fireEvent.click(screen.getByRole('button', { name: '标为已掌握' }));

        await waitFor(() => {
            expect(markVocabMastered).toHaveBeenCalledWith(1);
            expect(toast.success).toHaveBeenCalledWith('已标为已掌握');
        });
        expect(recordOutcome).not.toHaveBeenCalled();
        await waitFor(() => {
            const progress = parseFloat(screen.getByTestId('focus-shell').getAttribute('data-progress') || '0');
            expect(progress).toBeCloseTo(100, 1);
        });
    });

    it('should not show 熟 for unanchored grammar drills', () => {
        const unanchored = createDrills(1, 0)[0];
        unanchored.meta!.vocabId = 0;

        render(<SessionRunner userId="u5" mode="SYNTAX" initialPayload={[unanchored]} />);

        expect(screen.queryByRole('button', { name: '标为已掌握' })).toBeNull();
    });
});
