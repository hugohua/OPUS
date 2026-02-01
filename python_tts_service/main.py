"""
Opus TTS 服务 - FastAPI 应用入口

功能:
  阿里云 DashScope TTS 服务封装
  
使用方法:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  
注意:
  1. 需要配置 OPENAI_API_KEY 环境变量
  2. 音频缓存目录为 /app/audio（需通过 Volume 共享给 Next.js）
"""
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as tts_router
from api.websocket import ws_router
from core.config import config

# 配置结构化日志
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# 创建 FastAPI 应用
app = FastAPI(
    title="Opus TTS Service",
    description="阿里云 DashScope TTS 服务",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 配置 CORS（允许 Next.js 调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tts_router, prefix="/tts", tags=["TTS"])
app.include_router(ws_router, tags=["WebSocket TTS"])


@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    logger.info("tts_service_starting", version="1.0.0")
    
    # 验证配置
    try:
        config.validate()
        logger.info("config_validated", cache_dir=str(config.CACHE_DIR))
    except Exception as e:
        logger.error("config_validation_failed", error=str(e))
        raise
    
    logger.info("tts_service_started", status="ready")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    logger.info("tts_service_shutting_down")


@app.get("/", tags=["Root"])
async def root():
    """根路径"""
    return {
        "service": "Opus TTS Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
