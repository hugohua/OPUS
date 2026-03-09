/**
 * 通用复习模式定义
 * 
 * 设计原则：与业务场景解耦，通过 SCENE_MODES 注册表声明每个场景支持哪些模式。
 * 消费方：ReviewModePicker (UI), actions/drive.ts (后端), 未来 Blitz/Session
 */

// ------------------------------------------------------------------
// Scene IDs (场景标识)
// ------------------------------------------------------------------
export type SceneId = 'drive' | 'blitz' | 'session';

// ------------------------------------------------------------------
// Mode IDs (所有场景共享)
// ------------------------------------------------------------------
export type ReviewModeId =
    | 'SANDWICH'     // 三明治（暖身+复习+短语）
    | 'SRS_FOCUS'    // SRS 专攻（只清到期）
    | 'WEAK_REPAIR'  // 弱项修复（stability 最低优先）
    | 'IMMERSE'      // 沉浸听力（短语为主）
    | 'DISCOVERY';   // 新词探索（新词+复习混合）

// ------------------------------------------------------------------
// Batch Size (选词数量档位)
// ------------------------------------------------------------------
export const BATCH_SIZE_OPTIONS = [30, 50, 100] as const;
export type BatchSize = (typeof BATCH_SIZE_OPTIONS)[number];
export const DEFAULT_BATCH_SIZE: BatchSize = 50;

// ------------------------------------------------------------------
// Mode Config (模式元数据)
// ------------------------------------------------------------------
export interface ReviewModeSlots {
    warmup: number;   // 高稳定度暖身词
    review: number;   // SRS 到期复习词
    weak: number;     // 低稳定度薄弱词 (stability ASC)
    newWord: number;  // 未学新词
    phrase: number;   // 搭配短语
}

export interface ReviewModeConfig {
    id: ReviewModeId;
    label: string;       // 中文名称
    desc: string;        // 一句话描述
    icon: string;        // Lucide icon name
    /** 各队列占比 (总和必须 = 1) */
    slots: ReviewModeSlots;
}

export const REVIEW_MODES: Record<ReviewModeId, ReviewModeConfig> = {
    SANDWICH: {
        id: 'SANDWICH',
        label: '三明治',
        desc: '暖身 → 复习 → 短语休息，均衡节奏',
        icon: 'Layers',
        slots: { warmup: 0.2, review: 0.53, weak: 0, newWord: 0, phrase: 0.27 },
    },
    SRS_FOCUS: {
        id: 'SRS_FOCUS',
        label: 'SRS 专攻',
        desc: '只播放到期复习词，效率最高',
        icon: 'Target',
        slots: { warmup: 0, review: 1, weak: 0, newWord: 0, phrase: 0 },
    },
    WEAK_REPAIR: {
        id: 'WEAK_REPAIR',
        label: '弱项修复',
        desc: '优先 stability 最低的薄弱词',
        icon: 'Wrench',
        slots: { warmup: 0, review: 0, weak: 1, newWord: 0, phrase: 0 },
    },
    IMMERSE: {
        id: 'IMMERSE',
        label: '沉浸听力',
        desc: '短语为主，像磨耳朵一样轻松',
        icon: 'Headphones',
        slots: { warmup: 0.13, review: 0.33, weak: 0, newWord: 0, phrase: 0.54 },
    },
    DISCOVERY: {
        id: 'DISCOVERY',
        label: '新词探索',
        desc: '预览新词（仅曝光，不计入学习进度）',
        icon: 'Sparkles',
        slots: { warmup: 0, review: 0.67, weak: 0, newWord: 0.33, phrase: 0 },
    },
};

// ------------------------------------------------------------------
// Scene Registry (场景注册表)
// ------------------------------------------------------------------

/** 每个业务场景声明支持哪些模式 */
export const SCENE_MODES: Record<SceneId, ReviewModeId[]> = {
    drive: ['SANDWICH', 'SRS_FOCUS', 'WEAK_REPAIR', 'IMMERSE', 'DISCOVERY'],
    blitz: ['SRS_FOCUS', 'WEAK_REPAIR', 'DISCOVERY'],
    session: ['SANDWICH', 'SRS_FOCUS'],
};

/** 每个场景的默认模式 */
export const SCENE_DEFAULT_MODE: Record<SceneId, ReviewModeId> = {
    drive: 'SANDWICH',
    blitz: 'SRS_FOCUS',
    session: 'SANDWICH',
};

// ------------------------------------------------------------------
// Dev-only: Slots 比例校验
// ------------------------------------------------------------------
if (process.env.NODE_ENV === 'development') {
    for (const [id, config] of Object.entries(REVIEW_MODES)) {
        const sum = Object.values(config.slots).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 0.01) {
            console.warn(`[review-modes] ⚠️ ${id} slots 比例总和 = ${sum}，应为 1`);
        }
    }
}
