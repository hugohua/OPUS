import { create } from 'zustand';
import { BriefingPayload, DrillType } from '@/types/briefing';
import { fetchNextDrillV2 } from '@/actions/get-next-drill-v2';
import { submitAnswerV2 } from '@/actions/submit-answer-v2';
import { createLogger } from '@/lib/logger';

// Client-side simple logger
const log = {
    info: (msg: string, data?: any) => console.log(`[DrillStore] ${msg}`, data || ''),
    error: (msg: string, err: any) => console.error(`[DrillStore] ${msg}`, err),
};

interface DrillStoreState {
    // 数据流
    drills: BriefingPayload[];  // 待做队列 (Queue)
    history: BriefingPayload[]; // 历史记录 (Stack)
    currentIndex: number;

    // 状态
    isLoading: boolean;
    error: string | null;
    isSubmitting: boolean;

    // Actions
    initSession: (userId: string) => Promise<void>;
    fetchNext: (userId: string) => Promise<void>;
    submitCurrent: (
        userId: string,
        isPass: boolean,
        timeSpent: number
    ) => Promise<void>;

    // UI Helpers
    prefetchThreshold: number; // 剩余多少题时触发预加载
}

export const useDrillStore = create<DrillStoreState>((set, get) => ({
    drills: [],
    history: [],
    currentIndex: 0,
    isLoading: false,
    error: null,
    isSubmitting: false,
    prefetchThreshold: 2,

    initSession: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
            // 初始加载 3 个
            const p1 = fetchNextDrillV2(userId);
            const p2 = fetchNextDrillV2(userId);
            const p3 = fetchNextDrillV2(userId);

            const results = await Promise.all([p1, p2, p3]);

            const validDrills = results
                .filter(r => r.status === 'success' && r.data)
                .map(r => r.data!.drill);

            if (validDrills.length === 0) {
                set({ error: 'Failed to load drills' });
            } else {
                set({ drills: validDrills });
            }
        } catch (err: any) {
            set({ error: err.message });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchNext: async (userId: string) => {
        if (get().isLoading) return;

        try {
            const res = await fetchNextDrillV2(userId);
            if (res.status === 'success' && res.data) {
                set(state => ({
                    drills: [...state.drills, res.data!.drill]
                }));
            }
        } catch (err) {
            log.error('Prefetch failed', err);
        }
    },

    submitCurrent: async (userId, isPass, timeSpent) => {
        const { drills, currentIndex, isSubmitting, fetchNext, prefetchThreshold } = get();
        if (isSubmitting || !drills[currentIndex]) return;

        set({ isSubmitting: true });

        try {
            const currentDrill = drills[currentIndex];
            const { vocabId, drillType } = currentDrill.meta;

            // Optimistic Update: 立即切下一题
            // 实际上 submit 会在后台进行，不阻塞 UI 动画
            // 但需要等待 slide 动画完成再真正 set index? (由 UI 组件控制)

            // 1. 提交答案
            await submitAnswerV2({
                userId,
                vocabId: vocabId!,
                drillType: drillType || 'S_V_O',
                isPass,
                timeSpent
            });

            // 2. 移动指针
            set(state => ({
                history: [...state.history, currentDrill],
                currentIndex: state.currentIndex + 1,
                isSubmitting: false
            }));

            // 3. 检查预加载
            const remaining = drills.length - (currentIndex + 1);
            if (remaining <= prefetchThreshold) {
                fetchNext(userId);
            }

        } catch (err: any) {
            log.error('Submit failed', err);
            set({ isSubmitting: false, error: 'Submit failed' });
        }
    }
}));
