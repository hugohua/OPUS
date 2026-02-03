---
description: 运行 Hurl API 测试的标准流程
---
# 运行 Hurl 测试工作流

> **用途**: 执行已有的 Hurl API 测试  
> **触发场景**: PR 验证、回归测试、调试端点

## 前置条件
1. 安装 Hurl: `winget install Orange-OpenSource.Hurl --source winget`
2. 配置环境: 编辑 `tests/hurl.env`
3. 启动服务: `npm run dev` 或 `npm run dev:all`

## 步骤

// turbo-all

### 1. 运行 L1 防御层测试
```bash
hurl --variables-file tests/hurl.env --test tests/l1-*.hurl
```

### 2. 运行 L2 进攻层测试
```bash
hurl --variables-file tests/hurl.env --test tests/l2-*.hurl
```

### 3. 运行全量测试
```bash
hurl --variables-file tests/hurl.env --test tests/*.hurl
```

### 4. 详细调试单个测试
```bash
hurl --variables-file tests/hurl.env --verbose tests/l1-cron-prefetch.hurl
```

## 测试层级

| 层级 | 文件模式 | 覆盖范围 |
|------|----------|----------|
| L1 | `l1-*.hurl` | 认证、基础 CRUD |
| L2 | `l2-*.hurl` | 业务逻辑、AI 集成 |
| L3 | `l3-*.hurl` | SSE 流、复杂场景 |

## 相关文档
- 测试宪法: `.agent/rules/testing-protocol.md`
- 运行指南: `tests/README.md`
- 写 Hurl 规格: `/aidot-test` 工作流
