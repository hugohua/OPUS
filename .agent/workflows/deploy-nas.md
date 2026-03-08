---
description: 构建并部署 Opus 到 NAS (Synology)。包含自动读取配置、跨平台构建、导出和自动部署的全流程。
---
# 一键自动部署 NAS

> 详细文档参考 `docs/dev-notes/nas-deployment-guide.md`

## 前置条件
- 本地 Docker Desktop 已启动
- 已安装 `sshpass`（`brew install hudochenkov/sshpass/sshpass`）
- 当前目录下的 `.env` 文件已配置 NAS 账号及密码信息：`NAS_IP`, `NAS_PORT`, `NAS_USER`, `NAS_PATH`, `NAS_PASSWORD`

## 步骤

// turbo-all

1. 确认本地代码可编译（快速检查）:
```bash
npx tsc --noEmit
```

2. 执行一键构建并验证部署（脚本会自动读取 .env，跨平台构建并传输部署到 NAS，最后自动验证容器存活与网关连通性）:
```bash
./build-and-export.sh latest --deploy
```
