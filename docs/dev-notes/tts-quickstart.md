# TTS 服务快速启动指南

## 📦 已完成的实现

### ✅ 核心功能

1. **FastAPI 服务** - 完整的 HTTP REST API
2. **阿里云 DashScope 集成** - TTS 引擎调用
3. **MD5 Hash 缓存** - 与前端算法一致
4. **Docker 部署** - 完整的容器化配置
5. **结构化日志** - JSON 格式，易于监控

### ✅ 项目结构

```
python_tts_service/
├── main.py                    # ✅ FastAPI 应用入口
├── requirements.txt           # ✅ Python 依赖
├── Dockerfile                 # ✅ Docker 镜像配置
├── README.md                  # ✅ 完整文档
├── api/
│   ├── routes.py              # ✅ API 路由（/tts/generate, /tts/check 等）
│   └── models.py              # ✅ Pydantic 数据模型
├── core/
│   ├── config.py              # ✅ 配置管理
│   ├── hash.py                # ✅ Hash 生成（与前端一致）
│   └── cache.py               # ✅ 缓存管理器
├── services/
│   └── dashscope.py           # ✅ DashScope TTS 调用
└── tests/
    ├── test_hash.py           # ✅ Hash 单元测试
    └── test_startup.py        # ✅ 快速启动测试
```

---

## 🚀 快速启动（3 种方式）

### 方式 1: Docker Compose（推荐）

```bash
# 1. 构建并启动 TTS 服务
docker-compose up opus-tts --build

# 2. 检查服务状态
docker ps | grep opus-tts

# 3. 查看日志
docker logs -f opus-tts

# 4. 测试健康检查
curl http://localhost:8000/tts/health
```

**预期输出**:
```json
{
  "status": "healthy",
  "service": "opus-tts",
  "version": "1.0.0",
  "dashscope_connected": true
}
```

---

### 方式 2: 本地 Python 运行（开发调试）

```bash
# 1. 进入项目目录
cd python_tts_service

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量（使用项目根目录的 .env）
export OPENAI_API_KEY=sk-27bc50f0b4f646b98e3862c81a49101e
export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 4. 创建音频缓存目录
mkdir -p /tmp/opus_audio

# 5. 快速测试（不需要真实 API）
python test_startup.py

# 6. 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**访问**:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

### 方式 3: Docker 单独运行

```bash
# 1. 构建镜像
docker build -t opus-tts ./python_tts_service

# 2. 运行容器
docker run -d \
  --name opus-tts \
  -p 8000:8000 \
  -e OPENAI_API_KEY=sk-27bc50f0b4f646b98e3862c81a49101e \
  -e OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
  -v $(pwd)/public/audio:/app/audio \
  opus-tts

# 3. 查看日志
docker logs -f opus-tts
```

---

## 🧪 API 测试

### 1. 生成 TTS 音频

```bash
curl -X POST http://localhost:8000/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "voice": "Cherry",
    "language": "en-US",
    "speed": 1.0
  }'
```

**预期响应**:
```json
{
  "success": true,
  "cached": false,
  "hash": "a1b2c3d4e5f6...",
  "url": "/audio/a1b2c3d4e5f6.wav",
  "file_size": 40960
}
```

### 2. 检查缓存

```bash
curl http://localhost:8000/tts/check/a1b2c3d4e5f6
```

### 3. 获取缓存统计

```bash
curl http://localhost:8000/tts/stats
```

**响应示例**:
```json
{
  "total_files": 5,
  "total_size_bytes": 204800,
  "total_size_mb": 0.2,
  "cache_dir": "/app/audio"
}
```

---

## 🔧 配置说明

### 环境变量

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `OPENAI_API_KEY` | 阿里云 DashScope API Key | `sk-xxxxx` |
| `OPENAI_BASE_URL` | DashScope API 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |

### 核心配置（`core/config.py`）

```python
TTS_MODEL = "qwen3-tts-flash"           # TTS 模型
DEFAULT_VOICE = "Cherry"                # 默认声音
DEFAULT_LANGUAGE = "en-US"              # 默认语言
MAX_TEXT_LENGTH = 500                   # 最大文本长度
MAX_CONCURRENT_REQUESTS = 5             # 最大并发数
CACHE_DIR = Path("/app/audio")          # 缓存目录
```

### 支持的参数

#### Voice（声音）
- `Cherry` - 女声（清脆）
- `Alice` - 女声（柔和）
- `Nancy` - 女声（成熟）
- 更多声音参考 [DashScope 文档](https://help.aliyun.com/document_detail/464474.html)

#### Language（语言）
- `en-US` - 英语（美国）
- `zh-CN` - 中文（简体）
- `ja-JP` - 日语
- 等（通过参数传递）

#### Speed（速度）
- 范围: `0.5` - `2.0`
- 默认: `1.0`

---

## 🔗 与 Next.js 集成

### 1. 配置 Next.js Rewrite（可选）

在 `next.config.mjs` 中添加:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/tts/:path*',
        destination: 'http://localhost:8000/tts/:path*', // 本地开发
        // destination: 'http://opus-tts:8000/tts/:path*', // Docker 内部
      },
    ];
  },
};

export default nextConfig;
```

### 2. 前端调用示例

```typescript
// 直接调用（如果使用 Rewrite）
const response = await fetch('/api/tts/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello world',
    voice: 'Cherry',
    language: 'en-US',
    speed: 1.0
  })
});

const data = await response.json();
// { success: true, hash: "...", url: "/audio/xxx.wav" }
```

### 3. 音频文件访问

由于 Docker Volume 共享，音频文件可以直接通过 Next.js 的 `public` 目录访问:

```
http://localhost:3000/audio/a1b2c3d4e5f6.wav
```

---

## 📊 日志与监控

### 日志格式

所有日志以 JSON 格式输出:

```json
{
  "event": "tts_generated",
  "timestamp": "2026-01-28T20:47:00Z",
  "level": "info",
  "hash": "a1b2c3d4",
  "file_size": 40960,
  "cached": false,
  "text_length": 20
}
```

### 关键事件

- `tts_request` - TTS 生成请求
- `cache_hit` / `cache_miss` - 缓存命中/未命中
- `tts_generated` - 音频生成成功
- `dashscope_error` - DashScope API 错误
- `audio_cached` - 音频保存到缓存

### 查看日志

```bash
# Docker 日志
docker logs -f opus-tts

# 过滤特定事件
docker logs opus-tts 2>&1 | grep cache_hit
```

---

## ⚠️ 注意事项

### 1. DashScope API 限制

- **并发限制**: 系统默认限制 5 个并发请求
- **文本长度**: 单次最多 500 字符
- **配额管理**: 根据阿里云账户配额调整使用

### 2. 缓存策略

- **永久缓存**: 音频文件不会自动过期
- **磁盘空间**: 需定期监控 `public/audio/` 目录大小
- **Hash 一致性**: **必须**确保前端和后端 Hash 算法完全一致

### 3. Hash 算法验证

**关键**: 前端和后端必须使用相同的 Hash 算法！

**Python 侧**（`core/hash.py`）:
```python
hash_input = f"{text}_{voice}_{language}_{speed}"
return hashlib.md5(hash_input.encode('utf-8')).hexdigest()
```

**前端侧**（待实现 `lib/tts/hash.ts`）:
```typescript
const hash_input = `${text}_${voice}_${language}_${speed}`;
return crypto.createHash('md5').update(hash_input).digest('hex');
```

### 4. Docker Volume 权限

如果遇到权限问题:

```bash
chmod -R 777 public/audio
```

---

## 🐛 故障排查

### 问题 1: 容器启动失败

**症状**: `docker-compose up opus-tts` 失败

**检查**:
```bash
# 查看构建日志
docker-compose build opus-tts

# 查看容器日志
docker logs opus-tts
```

### 问题 2: DashScope API 调用失败

**症状**: 返回 500 错误，日志显示 `dashscope_error`

**检查清单**:
- [ ] `OPENAI_API_KEY` 是否正确
- [ ] 网络能否访问 `dashscope.aliyuncs.com`
- [ ] 阿里云账户配额是否用尽
- [ ] API Key 是否有 TTS 权限

**测试连接**:
```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/synthesis
```

### 问题 3: 音频文件无法访问

**症状**: 生成成功但前端访问 404

**检查**:
```bash
# 确认文件存在
ls -la public/audio/

# 确认 Docker Volume 挂载
docker inspect opus-tts | grep Mounts -A 10
```

### 问题 4: 缓存未命中

**症状**: 相同内容重复生成

**原因**: Hash 算法不一致

**验证**:
```bash
# Python 侧生成 Hash
curl -X POST http://localhost:8000/tts/generate \
  -d '{"text":"test"}' | jq '.hash'

# 前端侧生成 Hash（需实现后验证）
```

---

## 📝 下一步待办

### 前端集成（待实现）

1. [ ] 创建 `lib/tts/hash.ts` - Hash 生成工具（**必须与 Python 一致**）
2. [ ] 创建 `hooks/use-tts.ts` - TTS Hook
3. [ ] 创建 `components/tts-button.tsx` - TTS 按钮组件
4. [ ] 配置 `next.config.mjs` - Rewrite 规则

### 生产优化（可选）

1. [ ] 添加 Rate Limiting（防止滥用）
2. [ ] 实现音频压缩（WAV → MP3）
3. [ ] 添加缓存过期策略（LRU）
4. [ ] 集成监控系统（Prometheus）

---

## 🎯 测试检查清单

- [x] Hash 算法一致性测试
- [x] Docker 镜像构建成功
- [x] 服务健康检查通过
- [ ] 真实 DashScope API 调用测试（需有效 API Key）
- [ ] 缓存命中率测试
- [ ] 并发压力测试
- [ ] 前端集成测试

---

## 📚 参考文档

- [技术方案详细文档](./tts-service-technical-spec.md)
- [TTS 迁移方案](./TTS_MIGRATION_NEXTJS.md)
- [阿里云 DashScope 文档](https://help.aliyun.com/document_detail/2712195.html)
- [FastAPI 文档](https://fastapi.tiangolo.com/)

---

## 💡 小贴士

1. **本地开发**: 使用 `uvicorn main:app --reload` 启动，支持热重载
2. **API 文档**: 访问 `/docs` 可以直接在浏览器中测试 API
3. **日志调试**: 使用 `docker logs -f opus-tts` 实时查看日志
4. **Hash 验证**: 使用 `python test_startup.py` 快速验证基础功能

---

**服务已就绪！🎉** 现在可以开始前端集成了。
