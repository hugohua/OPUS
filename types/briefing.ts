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

// 共享基础字段
interface BaseSegment {
    content_markdown?: string;
    translation_cn?: string;
}

export interface TextSegment extends BaseSegment {
    type: "text";
    audio_text?: string;
    phonetic?: string;
}

export interface InteractionSegment extends BaseSegment {
    type: "interaction";
    dimension?: InteractionDimension;
    task?: {
        style: InteractionStyle;
        question_markdown: string;
        options: string[] | any[];
        answer_key: string;
        explanation_markdown?: string;
        explanation?: any;
        socraticHint?: string;
    };
}

export interface ChunkingSegment {
    type: "chunking_drill";
    full_sentence: string;
    chunks: any[];
    distractor_chunk?: string | null;
    analysis?: {
        skeleton: any;
        links: any[];
        business_insight: string;
    };
}

export type BriefingSegment = TextSegment | InteractionSegment | ChunkingSegment;

export interface BriefingPayload {
    meta: {
        format: BriefingFormat;
        mode: SessionMode;
        batch_size: number;
        sys_prompt_version: string;
        vocabId?: number;
        target_word?: string;
        target_zh?: string; // [Optional] Chinese translation
        source?: string;
        nuance_goal?: string;
        etymology?: any;
        stability?: number;
        sender_voice?: string;
        // [New] Dynamic fields from Generative output
        translation_cn?: string;
        grammar_point?: string;
    };
    segments: BriefingSegment[];
}

