# Opus (Mobile) - 英语学习工作台仿真器

Opus 是一个专为程序员和专业人士设计的英语学习应用，通过模拟真实工作场景（邮件、文档、会议）来提供沉浸式的学习体验。

## 🚀 快速开始 (本地开发)

### 1. 环境准备

确保本机已安装：
- **Node.js**: v20+
- **Docker & Docker Compose**: 用于运行数据库和其它基础设施
- **Python**: 3.11+ (用于 TTS 服务开发)

### 2. 启动基础设施

在本地开发时，我们需要使用 Docker 运行数据库 (Postgres)、缓存 (Redis) 和 TTS 服务，而由于 Next.js 应用通常在宿主机直接运行，我们需要正确配置它们之间的连接。

**启动开发环境容器：**

```bash
# 启动 Postgres, Redis, TTS
docker-compose -f docker-compose.dev.yml up -d
```

### 3. 配置环境变量 (.env)

Opus 使用 host mapping 方便宿主机访问容器服务。请确保你的 `/etc/hosts` 包含以下映射（可选，或直接使用 localhost）：

```text
127.0.0.1 opus-db
127.0.0.1 opus-redis
127.0.0.1 opus-tts
```

**推荐的 `.env` 配置：**

```properties
# 使用 host 别名 (需要配置 hosts) 或直接使用 localhost
DATABASE_URL="postgresql://postgres:postgres@opus-db:5432/opus?schema=public"
REDIS_URL="redis://opus-redis:6379"

# AI Provider 配置
OPENAI_API_KEY=sk-...
```

> **注意**：如果不配置 hosts，请将 `opus-db` 和 `opus-redis` 替换为 `localhost`。

### 4. 运行应用

```bash
# 安装依赖
npm install

# 启动完整开发环境 (Web + Worker + TTS Proxy)
npm run dev:all

# 或者仅启动 Web 端
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🛠️ 常用脚本

### 数据生成
```bash
# 生成词源数据 (持续模式)
npx tsx scripts/data-gen-etymology.ts --paid --continuous
```

### 数据库管理
```bash
# 打开 Prisma Studio 查看数据
npm run db:studio migrate
```

## 📦 生产部署

生产环境部署请参考 [DEPLOY.md](./DEPLOY.md)。

主要区别：
- 生产环境所有服务（包括 Web）都运行在 Docker 容器中。
- 数据库端口不对外暴露。
- 使用 `docker-compose.prod.yml` 进行编排。

## 🐛 故障排查

**Q: 脚本无法连接数据库 `Can't reach database server at opus-db:5432`**
A: 请检查：
1. `docker-compose -f docker-compose.dev.yml` 是否已启动。
2. 本机 `/etc/hosts` 是否配置了 `127.0.0.1 opus-db`。
3. 如果未配置 hosts，请暂时修改 `.env` 中的 `DATABASE_URL` 为 `localhost`。
