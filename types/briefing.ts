export type SessionMode = "SYNTAX" | "CHUNKING" | "NUANCE" | "BLITZ" | "AUDIO" | "READING" | "VISUAL" | "PHRASE";

export type BriefingFormat = "chat" | "email" | "memo";

export type InteractionStyle = "swipe_card" | "bubble_select";

export type InteractionDimension = "V" | "C" | "M" | "X" | "A";

export interface BriefingSegment {
    type: "text" | "interaction";
    content_markdown?: string;
    audio_text?: string;
    translation_cn?: string; // Added translation field
    dimension?: InteractionDimension;
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
        vocabId?: number; // Needed to track progress
        target_word?: string;
        source?: string; // Track origin (cache, deterministic, llm)
    };
    segments: BriefingSegment[];
}
