// 单一场景模式（用于 Simulate 页面和单独训练）
export type SingleScenarioMode =
    | "SYNTAX" | "PHRASE" | "BLITZ"    // L0 基础层
    | "AUDIO" | "CHUNKING"              // L1 感知层
    | "CONTEXT" | "NUANCE"              // L2 应用层
    | "READING" | "VISUAL";             // 其他模式

// 混合场景模式（用于首页智能混合）
export type MixedScenarioMode =
    | "L0_MIXED"      // 混合 SYNTAX, PHRASE, BLITZ
    | "L1_MIXED"      // 混合 AUDIO, CHUNKING
    | "L2_MIXED"      // 混合 CONTEXT, NUANCE
    | "DAILY_BLITZ";  // 全场景混合（L0+L1+L2）

// SessionMode 统一类型（向后兼容）
export type SessionMode = SingleScenarioMode | MixedScenarioMode;

export type BriefingFormat = "chat" | "email" | "memo" | "article";

export type InteractionStyle = "swipe_card" | "bubble_select" | "slot_machine";

export type InteractionDimension = "V" | "C" | "M" | "X" | "A";

export interface BriefingSegment {
    type: "text" | "interaction";
    content_markdown?: string;
    audio_text?: string;
    translation_cn?: string;
    phonetic?: string; // [New] Explicit phonetic field
    dimension?: InteractionDimension;
    task?: {
        style: InteractionStyle;
        question_markdown: string;
        options: string[] | any[]; // Support string[] or complex object[]
        answer_key: string;
        explanation_markdown?: string;
        explanation?: any; // Support rich explanation structure
        socraticHint?: string; // [L2] Socratic Tutor 引导提示
    };
}

export interface BriefingPayload {
    meta: {
        format: BriefingFormat;
        mode: SessionMode;
        batch_size: number;
        sys_prompt_version: string;
        vocabId?: number; // Needed to track progress
        target_word?: string;
        source?: string; // Track origin (cache, deterministic, llm)
        nuance_goal?: string; // PHRASE mode: semantic goal (e.g., "Describe quality")
        etymology?: any; // [New] Etymology data (Prisma Type or generic object)
        stability?: number; // 用于混合模式 Stability 统计
        sender_voice?: string; // [New] Dynamic voice for TTS (from Drive Constants)
    };
    segments: BriefingSegment[];
}

