# Python TTS 服务技术方案

## 📌 文档信息

| 属性 | 内容 |
|------|------|
| **服务名称** | Opus TTS Service |
| **版本** | v1.0 |
| **技术栈** | FastAPI + 阿里云 DashScope + Uvicorn |
| **部署方式** | Docker Container (独立服务) |
| **通信协议** | HTTP REST API |
| **创建时间** | 2026-01-28 |

---

## 1. 服务定位与职责

### 1.1 核心定位

**独立的微服务**，专门负责将文本转换为语音（TTS），为 Opus 前端提供音频生成和缓存能力。

### 1.2 核心职责

1. **音频生成**: 调用阿里云 DashScope `qwen3-tts-flash` 模型
2. **智能缓存**: 基于 MD5 Hash 的三层缓存机制
3. **文件管理**: 音频文件持久化存储
4. **性能优化**: 异步处理、流式传输

### 1.3 非职责（边界）

- ❌ **不负责**调度逻辑（由 Next.js Server Actions 管理）
- ❌ **不负责**用户认证（信任来自 Next.js 的请求）
- ❌ **不负责**数据库操作（只做文件缓存）

---

## 2. 技术架构设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │ useTTS Hook  │───────▶│ /api/tts     │                   │
│  └──────────────┘        └──────────────┘                   │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP POST/GET
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Python TTS Service (FastAPI)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /tts/generate                                   │   │
│  │  ├─ Validate Request (Pydantic)                       │   │
│  │  ├─ Generate Hash (MD5)                               │   │
│  │  ├─ Check Cache (File System)                         │   │
│  │  └─ Call DashScope API ─────────────────────┐        │   │
│  │                                              │        │   │
│  │  GET /tts/check/{hash}                       │        │   │
│  │  └─ Check if cached file exists              │        │   │
│  └──────────────────────────────────────────────┼────────┘   │
│                                                  │            │
│  ┌─────────────────────────────────────────────┐│            │
│  │         Cache Manager                        ││            │
│  │  ┌────────────────────────────────────────┐ ││            │
│  │  │ MD5 Hash: text_voice_lang_1.0          │ ││            │
│  │  │ Storage: /audio/{hash}.wav             │ ││            │
│  │  └────────────────────────────────────────┘ ││            │
│  └──────────────────────────────────────────────┘│            │
└────────────────────────────────────────────────── ┘            │
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │ 阿里云 DashScope API    │
                                    │ Model: qwen3-tts-flash  │
                                    └─────────────────────────┘
```

### 2.2 服务通信方式

**选择: HTTP REST API (Option A)**

| 方案 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| **HTTP REST** | 简单、易调试、无状态 | 无流式传输实时反馈 | ✅ **采用** |
| WebSocket | 实时流式传输 | 复杂、需连接管理 | ❌ 过度设计 |

**理由**: 
- TTS 生成时间通常 < 2s，HTTP 完全满足需求
- 阿里云 DashScope SDK 本身支持流式，但可在服务端完整接收后返回

---

## 3. API 设计规范

### 3.1 端点列表

#### 📍 `POST /tts/generate`

**功能**: 生成语音音频（Cache-First 策略）

**Request Body**:
```json
{
  "text": "Hello, world!",
  "voice": "Cherry",
  "language": "en-US",
  "speed": 1.0
}
```

**Response (Cache Hit)**:
```json
{
  "success": true,
  "cached": true,
  "hash": "a1b2c3d4e5f6...",
  "url": "/audio/a1b2c3d4e5f6.wav",
  "duration": 2.5,
  "file_size": 40960
}
```

**Response (New Generation)**:
```json
{
  "success": true,
  "cached": false,
  "hash": "a1b2c3d4e5f6...",
  "url": "/audio/a1b2c3d4e5f6.wav",
  "duration": 2.5,
  "file_size": 40960
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Text exceeds 500 characters",
  "error_code": "TEXT_TOO_LONG"
}
```

---

#### 📍 `GET /tts/check/{hash}`

**功能**: 检查缓存是否存在（用于客户端预检）

**Response (Exists)**:
```json
{
  "exists": true,
  "url": "/audio/a1b2c3d4e5f6.wav",
  "duration": 2.5
}
```

**Response (Not Found)**:
```json
{
  "exists": false
}
```

---

#### 📍 `GET /health`

**功能**: 健康检查（K8s/Docker 探针）

**Response**:
```json
{
  "status": "healthy",
  "service": "opus-tts",
  "version": "1.0.0",
  "dashscope_connected": true
}
```

---

### 3.2 数据验证规则

使用 **Pydantic** 进行严格验证：

```python
from pydantic import BaseModel, Field, validator

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    voice: str = Field(default="Cherry", pattern="^[A-Za-z]+$")
    language: str = Field(default="zh-CN", pattern="^[a-z]{2}-[A-Z]{2}$")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    
    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError('Text cannot be empty or whitespace only')
        return v.strip()
```

---

## 4. 缓存机制设计

### 4.1 Hash 生成算法

**必须与前端保持一致**（来自 TTS_MIGRATION_NEXTJS.md:Line 93）

```python
import hashlib

def generate_audio_hash(text: str, voice: str, language: str, speed: float = 1.0) -> str:
    """
    生成音频缓存 Hash
    
    ⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 的算法一致
    """
    hash_input = f"{text}_{voice}_{language}_{speed}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()
```

### 4.2 缓存存储策略

**单层磁盘缓存**（Python 服务仅负责此层）

```
public/audio/              # Shared Volume (Docker)
├── a1b2c3d4.wav          # Hash 作为文件名
├── e5f6g7h8.wav
└── metadata.json         # 可选：元数据索引
```

**Why Single Layer?**
- ✅ 内存缓存/LocalStorage 由前端 `useTTS` Hook 管理
- ✅ Python 服务无状态，重启不影响已缓存文件
- ✅ Docker Volume 挂载到 Next.js `public/` 目录，直接可访问

### 4.3 缓存元数据管理（可选）

创建 `public/audio/metadata.json` 跟踪缓存信息：

```json
{
  "a1b2c3d4e5f6": {
    "text": "Hello world",
    "voice": "Cherry",
    "language": "en-US",
    "duration": 2.5,
    "file_size": 40960,
    "created_at": "2026-01-28T12:30:00Z"
  }
}
```

**用途**:
- 缓存统计（总大小、命中率）
- 过期清理（可设置 TTL）
- Debug 和日志

---

## 5. 阿里云 DashScope 集成

### 5.1 SDK 选择

**官方 SDK**: `dashscope` (Python)

```bash
pip install dashscope
```

### 5.2 API 调用示例

```python
from dashscope.audio.tts_v2 import SpeechSynthesizer
import os

def call_dashscope_tts(text: str, voice: str = "Cherry") -> bytes:
    """
    调用阿里云 DashScope TTS API
    
    Returns:
        bytes: WAV 格式音频数据
    """
    api_key = os.getenv("DASHSCOPE_API_KEY")
    
    synthesizer = SpeechSynthesizer(
        model="qwen3-tts-flash",
        voice=voice,
        api_key=api_key
    )
    
    # 流式接收音频数据
    audio_chunks = []
    for chunk in synthesizer.call(text=text):
        if chunk:
            audio_chunks.append(chunk)
    
    return b''.join(audio_chunks)
```

### 5.3 错误处理

| 错误类型 | HTTP 状态码 | 响应策略 |
|---------|------------|---------|
| API Key 无效 | 500 | 返回错误，记录日志 |
| 配额超限 | 429 | 返回 Retry-After 头 |
| 网络超时 | 504 | 重试 3 次，失败返回错误 |
| 文本违规 | 400 | 返回具体错误信息 |

---

## 6. 部署架构

### 6.1 Docker 部署

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**docker-compose.yml 集成**:
```yaml
services:
  opus-tts:
    build: ./python_tts_service
    container_name: opus-tts
    ports:
      - "8000:8000"
    environment:
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
    volumes:
      - ./public/audio:/app/audio  # 共享音频目录
    networks:
      - opus-network
    restart: unless-stopped
```

### 6.2 Next.js 集成

**next.config.mjs**:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/tts/:path*',
        destination: 'http://opus-tts:8000/tts/:path*', // Docker 内部网络
      },
    ];
  },
};

export default nextConfig;
```

---

## 7. 性能优化策略

### 7.1 并发控制

使用 **FastAPI 异步特性**:

```python
from fastapi import FastAPI
import asyncio

app = FastAPI()

# 限制并发 TTS 请求数
semaphore = asyncio.Semaphore(5)

@app.post("/tts/generate")
async def generate_tts(request: TTSRequest):
    async with semaphore:
        # 处理 TTS 生成
        ...
```

### 7.2 预热缓存

**启动时预生成常用音频**:

```python
COMMON_WORDS = ["Hello", "Goodbye", "Thank you", "Please"]

@app.on_event("startup")
async def warmup_cache():
    for word in COMMON_WORDS:
        await generate_tts_internal(word, "Cherry", "en-US")
```

### 7.3 音频压缩

- **格式**: WAV (无损) → MP3 (压缩 90%)
- **采样率**: 24kHz (默认) → 16kHz (足够清晰)
- **工具**: `pydub` + `ffmpeg`

---

## 8. 监控与日志

### 8.1 日志规范

使用 **structlog** 结构化日志:

```python
import structlog

logger = structlog.get_logger()

logger.info(
    "tts_generated",
    hash=audio_hash,
    text_length=len(text),
    cached=False,
    duration_ms=elapsed_time
)
```

### 8.2 关键指标

需监控的指标:

1. **请求量**: 总请求数、成功率
2. **缓存命中率**: Hit / (Hit + Miss)
3. **生成耗时**: P50/P95/P99
4. **错误率**: 按错误类型分类
5. **磁盘使用**: 缓存文件总大小

---

## 9. 安全考虑

### 9.1 环境变量管理

```bash
# .env (仅在 Docker 内部访问)
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxx
MAX_TEXT_LENGTH=500
CACHE_DIR=/app/audio
```

### 9.2 输入过滤

防止注入攻击:

```python
import re

def sanitize_text(text: str) -> str:
    # 移除控制字符
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    # 限制长度
    return text[:500]
```

### 9.3 Rate Limiting

使用 **slowapi**:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/tts/generate")
@limiter.limit("10/minute")
async def generate_tts(request: Request):
    ...
```

---

## 10. 测试策略

### 10.1 单元测试

```python
# tests/test_hash.py
def test_hash_consistency():
    hash1 = generate_audio_hash("test", "Cherry", "en-US")
    hash2 = generate_audio_hash("test", "Cherry", "en-US")
    assert hash1 == hash2

def test_hash_uniqueness():
    hash1 = generate_audio_hash("test", "Cherry", "en-US")
    hash2 = generate_audio_hash("test", "Alice", "en-US")
    assert hash1 != hash2
```

### 10.2 集成测试

```python
# tests/test_api.py
from fastapi.testclient import TestClient

def test_generate_tts_success(client: TestClient):
    response = client.post("/tts/generate", json={
        "text": "Hello",
        "voice": "Cherry",
        "language": "en-US"
    })
    assert response.status_code == 200
    assert response.json()["success"] is True
```

---

## 11. 项目文件结构

```
python_tts_service/
├── Dockerfile
├── requirements.txt
├── main.py                    # FastAPI 应用入口
├── api/
│   ├── __init__.py
│   ├── routes.py              # API 路由
│   └── models.py              # Pydantic 模型
├── core/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── cache.py               # 缓存管理
│   └── hash.py                # Hash 生成
├── services/
│   ├── __init__.py
│   └── dashscope.py           # DashScope TTS 调用
├── tests/
│   ├── __init__.py
│   ├── test_hash.py
│   ├── test_cache.py
│   └── test_api.py
└── audio/                     # 音频缓存目录 (Docker Volume)
```

---

## 12. 阶段性实施计划

### Phase 1: 基础服务 (MVP)
- [x] FastAPI 项目初始化
- [ ] Hash 生成工具
- [ ] DashScope API 调用
- [ ] 基础缓存逻辑
- [ ] `/tts/generate` 端点

### Phase 2: 完整功能
- [ ] `/tts/check/{hash}` 端点
- [ ] 错误处理和重试
- [ ] 元数据管理
- [ ] Docker 部署

### Phase 3: 生产就绪
- [ ] Rate Limiting
- [ ] 监控和日志
- [ ] 性能优化
- [ ] 单元测试 + 集成测试

---

## 13. 技术风险与应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| DashScope API 不稳定 | 高 | 中 | 实现 Fallback (本地 TTS 引擎) |
| Hash 算法不一致 | 高 | 低 | 共享 Hash 生成测试用例 |
| 缓存磁盘爆满 | 中 | 中 | 实现 LRU 清理策略 |
| 并发压力过大 | 中 | 低 | 使用 Semaphore 限流 |

---

## 14. 下一步行动

1. ✅ **审阅本技术方案** - 确认架构设计
2. ⏳ **创建 Python 项目** - 初始化 `python_tts_service/` 目录
3. ⏳ **实现核心逻辑** - Hash、Cache、DashScope 调用
4. ⏳ **Docker 部署** - 编写 Dockerfile 和 docker-compose 配置
5. ⏳ **前端集成** - 配置 Next.js Rewrite 规则

---

## 📞 待确认问题

1. **音频格式**: WAV 还是 MP3？（WAV 更快，MP3 更省空间）
2. **缓存清理策略**: 是否需要自动清理？TTL 多久？
3. **DashScope Voice**: 除了 `Cherry`，还需要支持哪些声音？
4. **多语言支持**: 需要支持哪些语言？（zh-CN, en-US...）
5. **Docker Network**: 是否已有 `opus-network`？还是需要新建？
