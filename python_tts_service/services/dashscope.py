"""
阿里云 DashScope TTS 服务
"""
import io
import base64
from typing import Optional

import structlog
import dashscope

from core.config import config

logger = structlog.get_logger()


class DashScopeError(Exception):
    """DashScope API 错误"""
    pass


class DashScopeTTSService:
    """阿里云 DashScope TTS 服务封装"""
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required for DashScope TTS")
        
        # 全局设置 API Key
        dashscope.api_key = config.OPENAI_API_KEY
        self.model = config.TTS_MODEL
    
    def synthesize(
        self,
        text: str,
        voice: str = "Cherry",
        language: str = "en-US",
        speed: float = 1.0
    ) -> bytes:
        """
        调用 DashScope TTS API 生成语音 (qwen3-tts-flash)
        
        Args:
            text: 待转换文本
            voice: 声音名称（如 Cherry, Alice, Nancy 等）
            language: 语言代码（如 en-US, zh-CN）
            speed: 播放速度 (此模型暂不支持直接设置速度，但在 API 参数中保留兼容性)
            
        Returns:
            bytes: WAV 格式音频数据
            
        Raises:
            DashScopeError: API 调用失败
        """
        logger.info(
            "tts_request",
            text_length=len(text),
            voice=voice,
            language=language,
            speed=speed
        )
        
        try:
            # Direct passthrough - no mapping needed
            # Frontend now sends DashScope native voice names directly
            # Supported voices: Cherry, Serena, Ethan, Kai, Jennifer, Andre, etc.
            dashscope_voice = voice
            
            # 语言代码映射 (Standard Locale -> DashScope Format)
            language_map = {
                "en-US": "English",
                "en": "English",
                "zh-CN": "Chinese",
                "zh": "Chinese",
                "ja-JP": "Japanese",
                "ja": "Japanese",
                "ko-KR": "Korean",
                "ko": "Korean",
                "fr-FR": "French",
                "fr": "French",
                "es-ES": "Spanish",
                "es": "Spanish",
            }
            
            # 规范化语言参数
            dashscope_language = language_map.get(language, language)
            
            # 使用 MultiModalConversation 调用 (针对 qwen3-tts-flash)
            # 参考: python_tts_service2/main.py
            response = dashscope.MultiModalConversation.call(
                model=self.model,
                text=text,
                voice=dashscope_voice, # Use mapped voice
                language_type=dashscope_language,  # 使用规范化后的参数
                stream=True  # 启用流式输出
            )
            
            audio_buffer = bytearray()
            
            # 遍历流式响应收集音频数据
            for chunk in response:
                if chunk.status_code != 200:
                   error_msg = f"DashScope API error: {chunk.status_code} - {chunk.message}"
                   logger.error("tts_api_error", status=chunk.status_code, message=chunk.message)
                   raise DashScopeError(error_msg)

                if hasattr(chunk, 'output') and chunk.output:
                    audio_data_obj = chunk.output.get('audio')
                    if audio_data_obj and 'data' in audio_data_obj:
                        try:
                            # 解码 Base64 音频数据
                            chunk_bytes = base64.b64decode(audio_data_obj['data'])
                            audio_buffer.extend(chunk_bytes)
                        except Exception as decode_err:
                            logger.error("tts_decode_error", error=str(decode_err))
                            
            if not audio_buffer:
                raise DashScopeError("No audio data received from API")
            
            # 将 bytearray 转为 bytes (这是原始 PCM 数据)
            pcm_data = bytes(audio_buffer)
            
            # 添加 WAV 头 (DashScope 返回的是 24kHz, 16-bit mono PCM)
            import wave
            import io
            
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)       # 单声道
                wav_file.setsampwidth(2)       # 16-bit (2 bytes)
                wav_file.setframerate(24000)   # 阿里云 TTS 采样率
                wav_file.writeframes(pcm_data)
            
            final_audio = wav_buffer.getvalue()
            
            logger.info(
                "tts_success",
                audio_size_bytes=len(final_audio),
                text_preview=text[:50]
            )
            
            return final_audio
        
        except Exception as e:
            logger.error(
                "tts_generation_failed",
                error=str(e),
                text=text[:100]
            )
            raise DashScopeError(f"TTS generation failed: {str(e)}")


# 全局 TTS 服务实例
tts_service = DashScopeTTSService()
