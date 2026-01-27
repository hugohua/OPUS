/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SessionRunner } from '../session-runner';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { recordOutcome } from '@/actions/record-outcome';
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
// Mock child components to simplify DOM and focus on Logic
vi.mock('@/components/drill/universal-card', () => ({
    UniversalCard: ({ children, footer, onExit, progress }: any) => (
        <div data-testid="universal-card" data-progress={progress}>
            <button onClick={onExit} data-testid="exit-btn">Exit</button>
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
                    style: 'bubble_select',
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
        expect(screen.getByTestId('universal-card')).toBeTruthy();

        // Advance index 1 -> 2 (Remaining 11 -> 10)
        // SessionRunner UI: Footer has buttons.
        // We need to click "Next" or "Know" depending on mode.
        // Mode is SYNTAX (Standard). Footer has Options A/B.
        // Clicking Option triggers `handleOptionSelect` -> sets status -> shows Next button.

        // Helper to advance one slide
        const advanceSlide = async () => {
            // Click Option A (Correct)
            const optA = screen.getByText('Option A');
            fireEvent.click(optA);

            // Wait for Next Button
            const nextBtn = await screen.findByText(/Next Challenge/i);
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

        expect(screen.getByTestId('universal-card')).toBeTruthy();

        // Answer WRONG: Click Option B (Key is A)
        const optB = screen.getByText('Option B');
        fireEvent.click(optB);

        // Advance to next (Next Button should appear even if wrong, showing feedback)
        // Wait, SessionRunner logic: `setStatus(isCorrect ? "correct" : "wrong")`.
        // If wrong, Next button appears?
        // `FooterContent` shows Next Button if `status !== idle`. Yes.

        const nextBtn = await screen.findByText(/Next Challenge/i);
        fireEvent.click(nextBtn);

        // Verification:
        // Since we cannot inspect state directly, we verify behavior or side-effects?
        // We can verify if "Next Challenge" appeared implies complete.
        // We can check if `recordOutcome` was called with grade 1.

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
            const card = screen.getByTestId('universal-card');
            const progress = parseFloat(card.getAttribute('data-progress') || '0');
            expect(progress).toBeCloseTo(33.33, 1);
        });
    });
});
