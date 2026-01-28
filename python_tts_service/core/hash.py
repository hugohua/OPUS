"""
Hash 生成工具

⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 的算法保持一致
"""
import hashlib


def generate_audio_hash(
    text: str,
    voice: str = "Cherry",
    language: str = "en-US",
    speed: float = 1.0
) -> str:
    """
    生成音频缓存 Hash
    
    算法与前端保持完全一致:
    hash_input = `${text}_${voice}_${language}_${speed}`
    
    Args:
        text: 待转换文本
        voice: 声音名称
        language: 语言代码
        speed: 播放速度
        
    Returns:
        str: 32位 MD5 Hash (小写)
        
    Example:
        >>> generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        'a1b2c3d4e5f6...'
    """
    # 与前端算法一致: text_voice_language_speed
    hash_input = f"{text}_{voice}_{language}_{speed}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()
