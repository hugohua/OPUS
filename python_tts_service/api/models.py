"""
Pydantic 数据模型
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class TTSRequest(BaseModel):
    """TTS 生成请求模型"""
    
    text: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="待转换的文本内容"
    )
    voice: str = Field(
        default="Cherry",
        description="声音名称，如 Cherry, Alice, Nancy 等"
    )
    language: str = Field(
        default="en-US",
        description="语言代码，如 en-US, zh-CN"
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="播放速度，范围 0.5-2.0"
    )
    
    @field_validator('text')
    @classmethod
    def validate_text(cls, v: str) -> str:
        """验证文本不为空白"""
        if not v.strip():
            raise ValueError('Text cannot be empty or whitespace only')
        return v.strip()


class TTSResponse(BaseModel):
    """TTS 生成响应模型"""
    
    success: bool = Field(description="是否成功")
    cached: bool = Field(description="是否来自缓存")
    hash: str = Field(description="音频 Hash 值")
    url: str = Field(description="音频访问 URL")
    file_size: int = Field(description="文件大小（字节）")
    duration: Optional[float] = Field(default=None, description="音频时长（秒）")


class CacheCheckResponse(BaseModel):
    """缓存检查响应模型"""
    
    exists: bool = Field(description="缓存是否存在")
    url: Optional[str] = Field(default=None, description="音频 URL（如果存在）")
    file_size: Optional[int] = Field(default=None, description="文件大小（字节）")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    
    success: bool = Field(default=False)
    error: str = Field(description="错误信息")
    error_code: str = Field(description="错误代码")


class HealthResponse(BaseModel):
    """健康检查响应模型"""
    
    status: str = Field(description="服务状态")
    service: str = Field(default="opus-tts")
    version: str = Field(default="1.0.0")
    dashscope_connected: bool = Field(description="DashScope 连接状态")
