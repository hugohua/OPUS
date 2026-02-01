"""
配置管理模块
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载根目录 .env
_PROJECT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

class Config:
    """TTS 服务配置"""
    
    # 阿里云 DashScope 配置
    # 优先使用 OPENAI_API_KEY，如果没有则尝试使用 DASHSCOPE_API_KEY
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY") or os.getenv("DASHSCOPE_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    
    # TTS 模型配置
    # TTS 模型配置
    TTS_MODEL: str = "qwen3-tts-flash"
    DEFAULT_VOICE: str = "Cherry"
    DEFAULT_LANGUAGE: str = "English"
    DEFAULT_SPEED: float = 1.0
    
    # 文本限制
    MAX_TEXT_LENGTH: int = 500
    MIN_TEXT_LENGTH: int = 1
    
    # 速度限制
    MIN_SPEED: float = 0.5
    MAX_SPEED: float = 2.0
    
    # 缓存配置
    # 获取项目根目录 (假设 core/config.py 在 python_tts_service/core/)
    _PROJECT_ROOT = Path(__file__).parent.parent.parent
    CACHE_DIR: Path = Path("/app/audio") if Path("/app").exists() else _PROJECT_ROOT / "public" / "audio"
    ENABLE_CACHE: bool = True
    
    # 音频格式
    AUDIO_FORMAT: str = "wav"  # wav 或 mp3
    AUDIO_SAMPLE_RATE: int = 24000  # 24kHz
    
    # 并发控制
    MAX_CONCURRENT_REQUESTS: int = 5
    
    # 超时设置
    TTS_API_TIMEOUT: int = 30  # 秒
    
    @classmethod
    def validate(cls):
        """验证必要配置"""
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        # 确保缓存目录存在
        cls.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        return True


# 全局配置实例
config = Config()
