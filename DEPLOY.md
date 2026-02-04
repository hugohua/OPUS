# Opus 生产环境部署指南

本文档详细说明了如何在生产环境中部署 Opus 应用。

## 1. 准备工作

确保服务器已安装：
- [Docker](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## 2. 部署步骤

### 2.1 获取代码
```bash
git clone <repository_url>
cd OPUS
```

### 2.2 配置环境变量
生产环境配置文件模板已准备好，请复制并填入真实密钥：

```bash
cp .env.example.production .env.production
nano .env.production
```

> [!WARNING]
> 请务必修改 `AUTH_SECRET`, `POSTGRES_PASSWORD` 和各类 API KEY。

**域名配置说明**：

Opus 已配置 `trustHost: true`，支持通过**多种方式**访问：
- ✅ 域名：`https://opus.yourdomain.com`
- ✅ IP：`http://192.168.1.100`
- ✅ localhost（服务器本地）

`AUTH_URL` 仅用于生成邮件链接等场景，建议设置为主要访问域名：

```bash
# 设置为主域名（推荐）
export AUTH_URL=https://opus.yourdomain.com
export NEXTAUTH_URL=https://opus.yourdomain.com
docker-compose -f docker-compose.prod.yml up -d
```

> [!NOTE]
> 如果您的部署环境对安全性要求极高，可以在 `auth.config.ts` 中将 `trustHost: true` 改为明确的主机白名单。

### 2.3 启动服务
使用提供的脚本一键部署：

```bash
chmod +x deploy.sh
./deploy.sh
```

或者手动运行：

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## 3. 离线部署 (Air-gapped Support)

如果服务器无法访问外网，请使用以下流程：

### 3.1 构建与导出 (在有网机器上)
```bash
# 赋予脚本执行权限
chmod +x scripts/build-and-export.sh
# 构建所有镜像并导出到 dockers/ 目录
./scripts/build-and-export.sh
```

将生成的 `dockers/` 目录和项目代码（或仅 `docker-compose.prod.yml`, `.env.production` 等配置文件）传输到目标服务器。

### 3.2 导入与启动 (在目标服务器上)
```bash
# 导入所有镜像
chmod +x scripts/load-images.sh
./scripts/load-images.sh dockers/

# 启动服务 (无需构建)
docker-compose -f docker-compose.prod.yml up -d
```

## 4. 架构说明

部署架构采用了**微服务 + 网关**模式：

- **Nginx (Port 80)**: 唯一对外的入口，负责反向代理和静态资源缓存。
- **Opus Web (Next.js)**: 核心业务应用，不直接对外暴露端口。
- **Opus Worker**: 处理后台异步任务。
- **Opus TTS**: 独立的 Python 语音合成服务，仅供内部调用。
- **Postgres & Redis**: 数据库和缓存，配置了 Healthcheck，且移除了对外端口映射，确保数据安全。

## 4. 维护与监控

- **查看日志**:
  ```bash
  docker-compose -f docker-compose.prod.yml logs -f --tail=100
  ```

- **停止服务**:
  ```bash
  docker-compose -f docker-compose.prod.yml down
  ```

- **更新代码**:
  ```bash
  git pull
  ./deploy.sh
  ```
