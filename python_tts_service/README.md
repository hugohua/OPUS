# Python TTS Service

Python TTS 服务，基于阿里云 DashScope 提供文本转语音功能。

## 功能特性

- ✅ 阿里云 DashScope `qwen3-tts-flash` TTS 引擎
- ✅ MD5 Hash 缓存机制
- ✅ FastAPI 异步 HTTP 服务
- ✅ 并发控制（最多 5 个同时请求）
- ✅ 结构化日志（JSON 格式）
- ✅ Docker 部署支持

## API 端点

### POST /tts/generate
生成 TTS 音频

**Request:**
```json
{
  "text": "Hello, world!",
  "voice": "Cherry",
  "language": "en-US",
  "speed": 1.0
}
```

**Response:**
```json
{
  "success": true,
  "cached": false,
  "hash": "a1b2c3d4...",
  "url": "/audio/a1b2c3d4.wav",
  "file_size": 40960
}
```

### GET /tts/check/{hash}
检查缓存是否存在

**Response:**
```json
{
  "exists": true,
  "url": "/audio/a1b2c3d4.wav",
  "file_size": 40960
}
```

### GET /tts/stats
获取缓存统计

### GET /tts/health
健康检查

## 本地开发

### 1. 安装依赖

```bash
cd python_tts_service
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
export OPENAI_API_KEY=your_dashscope_api_key
export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 3. 启动服务

```bash
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Docker 部署

### 1. 构建镜像

```bash
docker build -t opus-tts ./python_tts_service
```

### 2. 运行容器

```bash
docker run -d \
  -p 8000:8000 \
  -e OPENAI_API_KEY=your_key \
  -v $(pwd)/public/audio:/app/audio \
  opus-tts
```

### 3. 使用 Docker Compose

```bash
docker-compose up opus-tts
```

## 项目结构

```
python_tts_service/
├── main.py              # FastAPI 应用入口
├── api/
│   ├── routes.py        # API 路由定义
│   └── models.py        # Pydantic 数据模型
├── core/
│   ├── config.py        # 配置管理
│   ├── hash.py          # Hash 生成（与前端一致）
│   └── cache.py         # 缓存管理
├── services/
│   └── dashscope.py     # DashScope TTS 调用
├── Dockerfile
└── requirements.txt
```

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | 阿里云 DashScope API Key | **必填** |
| `OPENAI_BASE_URL` | DashScope API URL | dashscope.aliyuncs.com |

### 配置参数

在 `core/config.py` 中可调整:

- `TTS_MODEL`: TTS 模型名称（默认 `qwen3-tts-flash`）
- `MAX_TEXT_LENGTH`: 最大文本长度（默认 500 字符）
- `MAX_CONCURRENT_REQUESTS`: 最大并发数（默认 5）
- `CACHE_DIR`: 缓存目录（默认 `/app/audio`）

## 缓存机制

### Hash 算法

与前端保持完全一致:
```python
hash = MD5(f"{text}_{voice}_{language}_{speed}")
```

### 缓存策略

1. **Cache-First**: 优先返回缓存
2. **文件存储**: 音频文件存储在 `/app/audio/{hash}.wav`
3. **元数据**: 可选的 `metadata.json` 跟踪缓存信息
4. **无过期**: 缓存永久有效（除非手动清理）

## 监控与日志

### 结构化日志

所有日志以 JSON 格式输出:

```json
{
  "event": "tts_generated",
  "timestamp": "2026-01-28T12:30:00Z",
  "hash": "a1b2c3d4",
  "file_size": 40960,
  "cached": false
}
```

### 关键指标

- `cache_hit` / `cache_miss`: 缓存命中/未命中
- `tts_generated`: 音频生成成功
- `dashscope_error`: API 调用失败

## 故障排查

### 1. DashScope API 调用失败

**症状**: 返回 500 错误，日志显示 `dashscope_error`

**检查**:
- API Key 是否正确
- 网络是否可达阿里云服务
- 配额是否用尽

### 2. 缓存目录权限问题

**症状**: 无法保存音频文件

**解决**:
```bash
chmod -R 777 public/audio
```

### 3. Docker 容器启动失败

**检查健康状态**:
```bash
docker ps
docker logs opus-tts
```

## 性能优化

- **并发控制**: 使用 `asyncio.Semaphore` 限制同时请求数
- **异步执行**: DashScope 调用在线程池中执行
- **缓存复用**: 相同内容永不重复生成

## 测试

```bash
# 运行测试
pytest

# 测试覆盖率
pytest --cov=. --cov-report=html
```

## 许可证

MIT
