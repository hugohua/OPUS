---
description: 执行本地开发环境到 NAS 生产环境的数据库同步，包含自动 Schema 表结构更新和静态题库数据同步。
---
# 数据库同步到 NAS

> 详细文档参考 `docs/dev-notes/nas-deployment-guide.md`

## 前置条件
- 本地 Docker Desktop 已启动且 `opus-db` 运行中
- 已完成本地的 `npx prisma migrate dev`
- 已安装 `sshpass`（`brew install hudochenkov/sshpass/sshpass`）
- 当前目录下的 `.env` 文件已配置 NAS 账号及密码信息：`NAS_IP`, `NAS_PORT`, `NAS_USER`, `NAS_PATH`, `NAS_PASSWORD`

## 步骤

// turbo-all

1. 确认最新的 Schema 和静态数据能够被本地导出（只做本地校验，不连接 NAS、不写生产库）:
```bash
./scripts/db-sync-to-nas.sh --dry-run
```

2. 执行默认同步（Schema 自动 push，不接受 data-loss 变更 + 追加模式注入静态数据，**不直接改写用户业务表**）:
```bash
./scripts/db-sync-to-nas.sh
```

**可选进阶命令**:
- 如果你只需要更新本地题库数据，而没有改变 Prisma 结构，可以加 `--skip-schema`:
  ```bash
  ./scripts/db-sync-to-nas.sh --skip-schema
  ```

- ⚠️ **重置题库模式 (危险)**：当你彻底清洗并重构了本地的所有题库，需要删除线上一切有关的旧题库时使用（注意：这会**连带级联删除**与之关联的用户做题记录等！）：
  ```bash
  ./scripts/db-sync-to-nas.sh --overwrite-danger
  ```
