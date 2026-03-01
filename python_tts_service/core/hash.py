"""
Hash 生成工具

⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 的算法保持一致
[V6.2] 新增 sanitize_for_tts: 在 Hash 前统一剥离 Markdown/XML 格式标记
"""
import hashlib
import re


def sanitize_for_tts(text: str) -> str:
    """
    清洗文本中的格式标记，确保 Hash 输入是纯净的自然语言。
    ⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 的 sanitizeForTTS() 完全一致
    处理内容:
    1. Markdown 加粗: **word** → word
    2. Markdown 斜体: *word* 或 _word_ → word
    3. Markdown 链接: [text](url) → text
    4. XML/HTML 标签: <chunk>, <s>, <v>, <o>, <emotional_tone="..."> 等 → 移除
    5. 多余空白: 压缩为单空格
    """
    result = text
    result = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', result) # Strip markdown links, keep text
    result = re.sub(r'(\*\*|__)(.*?)\1', r'\2', result)      # Strip bold (** or __)
    result = re.sub(r'(\*|_)(.*?)\1', r'\2', result)         # Strip italic (* or _)
    result = re.sub(r'<[^>]*>', '', result)                  # Strip XML/HTML tags
    result = re.sub(r'\s+', ' ', result).strip()             # Collapse whitespace
    return result


def generate_audio_hash(
    text: str,
    voice: str = "Cherry",
    language: str = "en-US",
    speed: float = 1.0
) -> str:
    """
    生成音频缓存 Hash
    
    [V6.2] 算法与前端保持完全一致:
    hash_input = `${sanitize(text)}_${voice}_${language}_${speed.toFixed(1)}`
    """
    cleaned = sanitize_for_tts(text)
    speed_str = f"{speed:.1f}"
    hash_input = f"{cleaned}_{voice}_{language}_{speed_str}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()

