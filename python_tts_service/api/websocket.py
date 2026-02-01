"""
WebSocket TTS 流式播放接口

基于 DashScope qwen3-tts-flash 模型实现实时音频流式输出
"""
import asyncio
import queue
import time
import base64
import hashlib
import wave
import re
from pathlib import Path
from typing import Optional

import structlog
import dashscope
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.config import config

logger = structlog.get_logger()

# 创建 WebSocket 路由器
ws_router = APIRouter()


def split_text(text: str, max_length: int = 500) -> list:
    """
    智能文本分块，按句子分割，保持语义完整
    
    Args:
        text: 要分割的文本
        max_length: 每块最大字符数
        
    Returns:
        文本块列表
    """
    chunks = []
    current_chunk = ""
    
    # 按句子分割
    sentences = text.replace('。', '。\n').replace('！', '！\n').replace('？', '？\n').split('\n')
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        if len(current_chunk) + len(sentence) <= max_length:
            current_chunk += sentence
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk)
    
    # 如果没有分块成功，直接截断
    return chunks if chunks else [text[:max_length]]


async def save_audio_file(pcm_data: bytearray, text: str, voice: str, language: str):
    """
    将 PCM 数据保存为 WAV 文件 (Stream-and-Save 策略)
    
    参数:
        pcm_data: 原始 PCM 音频数据
        text: 原始文本
        voice: 音色
        language: 语言
    """
    try:
        # 生成哈希 (与前端保持一致)
        hash_input = f"{text}_{voice}_{language}_1.0"
        audio_hash = hashlib.md5(hash_input.encode()).hexdigest()
        
        # 文件路径
        audio_dir = config.CACHE_DIR
        audio_dir.mkdir(parents=True, exist_ok=True)
        
        file_name = f"{audio_hash}.wav"
        file_path = audio_dir / file_name
        
        # 检查文件是否已存在
        if file_path.exists():
            logger.info("ws_audio_cache_exists", hash=audio_hash)
            return
        
        # 写入 WAV 文件
        with wave.open(str(file_path), 'wb') as wav_file:
            wav_file.setnchannels(1)       # 单声道
            wav_file.setsampwidth(2)       # 16-bit
            wav_file.setframerate(24000)   # 阿里云 TTS 采样率
            wav_file.writeframes(bytes(pcm_data))
        
        logger.info("ws_audio_saved", hash=audio_hash, size=len(pcm_data))
            
    except Exception as e:
        logger.error("ws_audio_save_failed", error=str(e))


@ws_router.websocket("/ws/tts")
async def websocket_tts(websocket: WebSocket):
    """
    WebSocket TTS 流式播放接口 (支持连接复用)
    
    接收 JSON 格式:
    {
        "requestId": "唯一请求ID",
        "text": "要合成的文本",
        "voice": "Cherry",      // 可选,默认 Cherry
        "language": "English"   // 可选,默认 English
    }
    
    或心跳消息:
    { "type": "ping" }
    
    发送 JSON 格式:
    { "type": "audio", "data": "base64_pcm_data", "sample_rate": 24000, "requestId": "..." }
    { "type": "done", "requestId": "..." }
    { "type": "error", "message": "...", "requestId": "..." }
    { "type": "pong" }  // 心跳响应
    """
    await websocket.accept()
    logger.info("ws_connected")
    
    try:
        # 循环处理多个请求,保持连接活跃
        while True:
            try:
                # 接收客户端请求
                data = await websocket.receive_json()
                t_request_received = time.time()
                
                # 处理心跳消息
                if data.get('type') == 'ping':
                    await websocket.send_json({"type": "pong"})
                    continue
                
                text = data.get('text', '')
                voice = data.get('voice', 'Cherry')
                language = data.get('language', 'English')
                request_id = data.get('requestId', '')
                
                if not text:
                    await websocket.send_json({
                        "type": "error",
                        "message": "文本不能为空",
                        "requestId": request_id
                    })
                    continue
                
                # 清理文本
                text = text.replace('*', '').replace('#', '').strip()
                text = re.sub(r'(?m)^\s*(?:Title|标题)[:：]\s*', '', text)
                text = re.sub(r'(?m)^\s*[-]{3,}\s*$', '', text)
                text = text.strip()
                
                # 文本分块
                chunks = split_text(text, max_length=500)
                text_to_process = chunks[0]
                
                logger.info(
                    "ws_tts_request",
                    request_id=request_id,
                    text_length=len(text_to_process),
                    voice=voice
                )
                
                # 获取事件循环
                loop = asyncio.get_event_loop()
                
                # 缓存策略: 仅对短文本缓存
                should_cache = len(chunks) == 1
                pcm_buffer = bytearray() if should_cache else None
                
                # 使用队列在线程间传递数据
                audio_queue = queue.Queue()
                
                def call_tts():
                    """在线程池中调用 TTS API"""
                    try:
                        response = dashscope.MultiModalConversation.call(
                            model='qwen3-tts-flash',
                            text=text_to_process,
                            voice=voice,
                            language_type=language,
                            stream=True
                        )
                        
                        for chunk in response:
                            if hasattr(chunk, 'output') and chunk.output:
                                audio_data = chunk.output.get('audio')
                                if audio_data and 'data' in audio_data:
                                    audio_queue.put({
                                        "type": "audio",
                                        "data": audio_data['data'],
                                        "sample_rate": 24000
                                    })
                        
                        audio_queue.put(None)  # 完成信号
                        
                    except Exception as e:
                        logger.error("ws_tts_api_error", error=str(e))
                        audio_queue.put({
                            "type": "error",
                            "message": f"TTS 服务错误: {str(e)}"
                        })
                        audio_queue.put(None)
                
                # 在线程池中执行 TTS 调用
                loop.run_in_executor(None, call_tts)
                
                # 从队列读取并发送给客户端
                while True:
                    try:
                        msg = await asyncio.get_event_loop().run_in_executor(
                            None, 
                            lambda: audio_queue.get(timeout=0.1)
                        )
                        
                        if msg is None:
                            break
                        
                        # 缓存 PCM 数据
                        if should_cache and msg.get('type') == 'audio' and 'data' in msg:
                            try:
                                pcm_bytes = base64.b64decode(msg['data'])
                                pcm_buffer.extend(pcm_bytes)
                            except Exception:
                                pass
                        
                        # 添加 requestId
                        if isinstance(msg, dict) and request_id:
                            msg['requestId'] = request_id
                        await websocket.send_json(msg)
                        
                    except queue.Empty:
                        await asyncio.sleep(0.01)
                        continue
                
                # 发送完成信号
                await websocket.send_json({
                    "type": "done",
                    "requestId": request_id
                })
                
                # 后台保存音频
                if should_cache and pcm_buffer and len(pcm_buffer) > 0:
                    asyncio.create_task(save_audio_file(pcm_buffer, text, voice, language))
                
                logger.info(
                    "ws_tts_complete",
                    request_id=request_id,
                    duration_ms=int((time.time() - t_request_received) * 1000)
                )
                
            except WebSocketDisconnect:
                logger.info("ws_client_disconnected")
                break
            except Exception as e:
                logger.error("ws_request_error", error=str(e))
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e),
                        "requestId": data.get('requestId', '') if 'data' in locals() else ''
                    })
                except:
                    pass
                    
    except WebSocketDisconnect:
        logger.info("ws_disconnected")
    except Exception as e:
        logger.error("ws_error", error=str(e))
    finally:
        logger.info("ws_cleanup")
