import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('@/actions/get-next-drill-v2', () => ({
    fetchNextDrillV2: vi.fn()
}));

vi.mock('@/actions/submit-answer-v2', () => ({
    submitAnswerV2: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({ error: vi.fn() })
}));

import { useDrillStore } from '../use-drill-store';
import { fetchNextDrillV2 } from '@/actions/get-next-drill-v2';
import { submitAnswerV2 } from '@/actions/submit-answer-v2';

describe('useDrillStore', () => {
    beforeEach(() => {
        useDrillStore.setState({ drills: [], currentIndex: 0, isLoading: false, isSubmitting: false });
        vi.clearAllMocks();
    });

    it('initSession should load initial drills', async () => {
        const mockDrill = { meta: { vocabId: 1 }, segments: [] };
        (fetchNextDrillV2 as any).mockResolvedValue({
            status: 'success',
            data: { drill: mockDrill }
        });

        await useDrillStore.getState().initSession('user1');

        const state = useDrillStore.getState();
        expect(state.drills.length).toBe(3); // 3 parallel fetches
        expect(fetchNextDrillV2).toHaveBeenCalledTimes(3);
    });

    it('submitCurrent should submit and advance index', async () => {
        // Setup initial state
        const mockDrill = { meta: { vocabId: 1, drillType: 'S_V_O' } };
        useDrillStore.setState({ drills: [mockDrill as any, {} as any] });

        (submitAnswerV2 as any).mockResolvedValue({ status: 'success' });

        await useDrillStore.getState().submitCurrent('user1', true, 1000);

        const state = useDrillStore.getState();
        expect(state.currentIndex).toBe(1);
        expect(submitAnswerV2).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user1',
            vocabId: 1,
            isPass: true
        }));
    });

    it('should prefetch when threshold reached', async () => {
        // Setup: 2 drills, index at 0. prefetchThreshold=2.
        // remaining = 2 - (0+1) = 1. <= 2.
        // So it should prefetch immediately?
        // Wait, prefetch check is inside submitCurrent.

        const mockDrill = { meta: { vocabId: 1 } };
        useDrillStore.setState({
            drills: [mockDrill as any, {} as any],
            currentIndex: 0,
            prefetchThreshold: 2
        });

        (fetchNextDrillV2 as any).mockResolvedValue({
            status: 'success',
            data: { drill: { meta: { vocabId: 3 } } }
        });

        await useDrillStore.getState().submitCurrent('user1', true, 1000);

        expect(fetchNextDrillV2).toHaveBeenCalled();
    });
});
