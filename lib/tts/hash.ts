/**
 * 音频 Hash 生成工具
 * 
 * ⚠️ CRITICAL: 必须与 Python 后端 (core/hash.py) 算法完全一致
 * Algorithm: MD5(`${sanitizedText}_${voice}_${language}_${speed}`)
 * 
 * [V6.2] 新增 Sanitization 层:
 * 前端多个场景会传入带 Markdown (**bold**) 或 XML (<chunk>) 标记的文本。
 * 为保证 Hash 一致性，在计算 Hash 前统一剥离这些格式标记。
 */
import MD5 from 'crypto-js/md5';

// Global memory cache for TTS URLs shared between useTTS and preload utilities
export const ttsMemoryCache = new Map<string, string>();

interface HashOptions {
    text: string;
    voice?: string;
    language?: string;
    speed?: number;
}

/**
 * 清洗文本中的格式标记，确保 Hash 输入是纯净的自然语言。
 * 
 * 处理内容:
 * 1. Markdown 加粗: **word** → word
 * 2. Markdown 斜体: *word* 或 _word_ → word
 * 3. Markdown 链接: [text](url) → text
 * 4. XML/HTML 标签: <chunk>, <s>, <v>, <o>, <emotional_tone="..."> 等 → 移除
 * 5. 多余空白: 压缩为单空格
 */
export function sanitizeForTTS(text: string): string {
    return text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip markdown links, keep text
        .replace(/(\*\*|__)(.*?)\1/g, '$2')      // Strip bold (** or __)
        .replace(/(\*|_)(.*?)\1/g, '$2')         // Strip italic (* or _)
        .replace(/<[^>]*>/g, '')             // Strip XML/HTML tags
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .trim();
}

export function generateAudioHash({
    text,
    voice = 'Cherry',
    language = 'en-US',
    speed = 1.0,
}: HashOptions): string {
    // [V6.2] 在 Hash 前统一清洗，保证无论输入是否带 Markdown，Hash 始终一致
    const cleanText = sanitizeForTTS(text);

    // 按照特定顺序拼接: text_voice_language_speed
    // 注意：Python 侧默认值必须与此处一致
    const hashInput = `${cleanText}_${voice}_${language}_${speed.toFixed(1)}`;

    return MD5(hashInput).toString();
}
