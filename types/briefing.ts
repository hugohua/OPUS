export type SessionMode = "SYNTAX" | "CHUNKING" | "NUANCE" | "BLITZ";

export type BriefingFormat = "chat" | "email" | "memo";

export type InteractionStyle = "swipe_card" | "bubble_select";

/**
 * @deprecated 旧版维度代码，后续删除
 * 使用 DimensionCode 替代
 */
export type InteractionDimension = "V" | "C" | "M" | "X" | "A";

// ============================================
// [V2.0 New] 五维记忆系统类型定义
// ============================================

/**
 * 题型枚举 (TOEIC Adapted)
 * - S_V_O: 义 (Meaning) - 快速语义映射
 * - VISUAL_TRAP: 形 (Visual) - 形似词找茬
 * - PART5_CLOZE: 境 (Context) - Part5 语法填空
 * - AUDIO_RESPONSE: 音 (Audio) - 听力 [遗留]
 * - PARAPHRASE_ID: 理 (Logic) - 同义替换 [遗留]
 */
export type DrillType =
    | "S_V_O"
    | "VISUAL_TRAP"
    | "PART5_CLOZE"
    | "AUDIO_RESPONSE"
    | "PARAPHRASE_ID";

/**
 * 维度代码 (数据库字段映射)
 * CTX -> dim_ctx_score (境)
 * VIS -> dim_vis_score (形)
 * MEA -> dim_mea_score (义)
 * AUD -> dim_aud_score (音) [遗留]
 * LOG -> dim_log_score (理) [遗留]
 */
export type DimensionCode = "CTX" | "VIS" | "MEA" | "AUD" | "LOG";

/**
 * 题型到维度的映射
 */
export const DRILL_TYPE_TO_DIMENSION: Record<DrillType, DimensionCode> = {
    PART5_CLOZE: "CTX",
    VISUAL_TRAP: "VIS",
    S_V_O: "MEA",
    AUDIO_RESPONSE: "AUD",
    PARAPHRASE_ID: "LOG",
};

/**
 * 维度到数据库字段的映射
 */
export const DIMENSION_TO_DB_FIELD: Record<DimensionCode, string> = {
    CTX: "dim_ctx_score",
    VIS: "dim_vis_score",
    MEA: "dim_mea_score",
    AUD: "dim_aud_score",
    LOG: "dim_log_score",
};

export interface BriefingSegment {
    type: "text" | "interaction";
    content_markdown?: string;
    audio_text?: string;
    translation_cn?: string;
    /** @deprecated 使用 dimension (DimensionCode) 替代 */
    dimension?: InteractionDimension | DimensionCode;
    task?: {
        style: InteractionStyle;
        question_markdown: string;
        options: string[];
        answer_key: string;
        explanation_markdown?: string;
    };
}

export interface BriefingPayload {
    meta: {
        format: BriefingFormat;
        mode: SessionMode;
        batch_size: number;
        sys_prompt_version: string;
        vocabId?: number;
        target_word?: string;
        source?: string;
        // [V2.0 New] 五维系统字段
        drillType?: DrillType;
        dimension?: DimensionCode;
    };
    segments: BriefingSegment[];
}
