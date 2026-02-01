// ------------------------------------------------------------------
// Drive Mode Definitions
// Shared between Server Actions (actions/drive.ts) and Client Components (DriveLayout.tsx)
// ------------------------------------------------------------------

export type DriveMode = 'QUIZ' | 'WASH' | 'STORY';

// DashScope Voice Types (qwen3-tts-flash)
// Selected subset for Drive Mode optimization
export type DashScopeVoice =
    | 'Cherry'    // 芊悦 - 阳光积极 (通用女,最常用)
    | 'Serena'    // 苏瑶 - 温柔 (答案阶段)
    | 'Ethan'     // 晨煦 - 阳光活力 (通用男)
    | 'Kai'       // 凯 - 磁性舒缓 (问题阶段)
    | 'Jennifer'  // 詹妮弗 - 品牌级美语 (高级场景)
    | 'Andre'     // 安德雷 - 沉稳自然 (故事模式)
    | 'Maia'      // 四月 - 知性温柔 (备选)
    | 'Neil';     // 阿闻 - 新闻主持 (正式场景)

export interface DriveItem {
    id: string;
    text: string;     // Main text to display (word or sentence)
    trans: string;    // Main translation
    phonetic: string;

    // Detailed Metadata
    word: string;     // The target word
    pos: string;      // Part of speech
    meaning: string;  // Core succinct meaning
    scenarios?: string[]; // 场景标签 (用于聚类)
    stability?: number;   // FSRS 稳定度 (用于难度分层)

    // Playback Logic
    mode: DriveMode;
    audioUrl?: string; // Optional, can be empty for JIT generation

    // Audio Config
    voice: DashScopeVoice;
    speed: number;
}

// Voice Configuration Constants (统一配置,避免重复字符串)
export const DRIVE_VOICE_CONFIG = {
    WARMUP: 'Ethan',           // 暖身 - 阳光活力
    QUIZ_QUESTION: 'Kai',      // Quiz 问题 - 磁性舒缓
    QUIZ_ANSWER: 'Serena',     // Quiz 答案 - 温柔
    WASH_PHRASE: 'Cherry',     // Wash 短语 - 亲切自然
    STORY: 'Andre',            // Story 模式 - 沉稳自然
} as const satisfies Record<string, DashScopeVoice>;

// 语速校准配置 (不同音色自然语速不同,需要校准以保持一致听感)
export const DRIVE_VOICE_SPEED_PRESETS: Record<DashScopeVoice, number> = {
    'Cherry': 0.9,   // 语速较快,调慢
    'Serena': 1.0,   // 标准
    'Ethan': 1.0,    // 标准
    'Kai': 0.9,      // 问题需要清晰,稍慢
    'Jennifer': 1.0,
    'Andre': 1.0,
    'Maia': 1.0,
    'Neil': 1.0
};
