"""
FastAPI 路由定义
"""
import asyncio
from pathlib import Path
from typing import Dict, Any

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from api.models import (
    TTSRequest,
    TTSResponse,
    CacheCheckResponse,
    ErrorResponse,
    HealthResponse
)
from core.hash import generate_audio_hash
from core.cache import cache_manager
from core.config import config
from services.dashscope import tts_service, DashScopeError

logger = structlog.get_logger()

# 创建路由器
router = APIRouter()

# 并发控制：限制同时处理的 TTS 请求数
_semaphore = asyncio.Semaphore(config.MAX_CONCURRENT_REQUESTS)


@router.post(
    "/generate",
    response_model=TTSResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    },
    summary="生成 TTS 音频",
    description="生成语音音频，采用 Cache-First 策略"
)
async def generate_tts(request: TTSRequest) -> TTSResponse:
    """
    生成 TTS 音频
    
    流程:
    1. 生成 Hash
    2. 检查缓存
    3. 如果缓存命中，直接返回
    4. 否则调用 DashScope API 生成
    5. 保存到缓存并返回
    """
    async with _semaphore:
        try:
            # 1. 生成 Hash
            audio_hash = generate_audio_hash(
                text=request.text,
                voice=request.voice,
                language=request.language,
                speed=request.speed
            )
            
            logger.info(
                "tts_generate_request",
                hash=audio_hash,
                text_length=len(request.text),
                voice=request.voice,
                language=request.language
            )
            
            # 2. 检查缓存
            if cache_manager.exists(audio_hash):
                audio_path = cache_manager.get_audio_path(audio_hash)
                file_size = audio_path.stat().st_size
                
                return TTSResponse(
                    success=True,
                    cached=True,
                    hash=audio_hash,
                    url=f"/audio/{audio_hash}.{config.AUDIO_FORMAT}",
                    file_size=file_size
                )
            
            # 3. 调用 DashScope API（同步调用，在线程池中执行）
            loop = asyncio.get_event_loop()
            audio_data = await loop.run_in_executor(
                None,
                tts_service.synthesize,
                request.text,
                request.voice,
                request.language,
                request.speed
            )
            
            # 4. 保存到缓存
            audio_path = cache_manager.save_audio(
                hash_key=audio_hash,
                audio_data=audio_data,
                metadata={
                    "text": request.text,
                    "voice": request.voice,
                    "language": request.language,
                    "speed": request.speed
                }
            )
            
            file_size = audio_path.stat().st_size
            
            logger.info(
                "tts_generated",
                hash=audio_hash,
                file_size=file_size,
                cached=False
            )
            
            return TTSResponse(
                success=True,
                cached=False,
                hash=audio_hash,
                url=f"/audio/{audio_hash}.{config.AUDIO_FORMAT}",
                file_size=file_size
            )
        
        except DashScopeError as e:
            logger.error("dashscope_error", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error": str(e),
                    "error_code": "DASHSCOPE_ERROR"
                }
            )
        
        except Exception as e:
            logger.error("unexpected_error", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error": "Internal server error",
                    "error_code": "INTERNAL_ERROR"
                }
            )


@router.get(
    "/check/{hash}",
    response_model=CacheCheckResponse,
    summary="检查缓存是否存在",
    description="检查指定 Hash 的音频文件是否已缓存"
)
async def check_cache(hash: str) -> CacheCheckResponse:
    """
    检查缓存是否存在
    
    Args:
        hash: 音频 Hash 值
        
    Returns:
        CacheCheckResponse: 缓存检查结果
    """
    exists = cache_manager.exists(hash)
    
    if exists:
        audio_path = cache_manager.get_audio_path(hash)
        file_size = audio_path.stat().st_size
        
        return CacheCheckResponse(
            exists=True,
            url=f"/audio/{hash}.{config.AUDIO_FORMAT}",
            file_size=file_size
        )
    
    return CacheCheckResponse(exists=False)


@router.get(
    "/stats",
    summary="获取缓存统计",
    description="获取缓存目录的统计信息"
)
async def get_cache_stats() -> Dict[str, Any]:
    """获取缓存统计信息"""
    return cache_manager.get_cache_stats()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="健康检查",
    description="检查服务健康状态"
)
async def health_check() -> HealthResponse:
    """
    健康检查
    
    检查项:
    - 服务是否运行
    - DashScope API 是否可用
    """
    # 简单检查 API Key 是否配置
    dashscope_connected = bool(config.OPENAI_API_KEY)
    
    return HealthResponse(
        status="healthy" if dashscope_connected else "degraded",
        service="opus-tts",
        version="1.0.0",
        dashscope_connected=dashscope_connected
    )
