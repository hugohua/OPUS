# Opus Hurl 测试指南

## 前置条件

1. 安装 Hurl: https://hurl.dev/docs/installation.html
2. 启动开发服务器: `npm run dev`

## 运行测试

### 运行所有 L1 测试
```bash
hurl --variables-file tests/hurl.env --test tests/l1-*.hurl
```

### 运行单个测试
```bash
hurl --variables-file tests/hurl.env --test tests/l1-cron-prefetch.hurl
```

### 查看详细输出
```bash
hurl --variables-file tests/hurl.env --very-verbose tests/l1-tts-generate.hurl
```

## 配置说明

### tests/hurl.env
```env
BASE_URL=http://localhost:3000    # 开发服务器地址
CRON_SECRET=xxx                   # 与 vercel.json 中的 secret 一致
TEST_USER_ID=test_user_hurl_001   # 测试用户标识
```

## 测试数据约定 (方案 B)

为避免污染开发数据库，所有测试数据必须遵循：

| 数据类型 | 标记规则 | 示例 |
|----------|----------|------|
| 用户 ID | `test_user_hurl_*` | `test_user_hurl_001` |
| 词汇 | `TEST_` 前缀 | `TEST_abandon` |
| TTS 文本 | `TEST_` 前缀 | `TEST_Hello World` |

查询时可使用 `WHERE word NOT LIKE 'TEST_%'` 过滤测试数据。

## 测试文件清单

| 文件 | 优先级 | 覆盖端点 | 状态 |
|------|--------|----------|------|
| `l1-cron-prefetch.hurl` | P0 | `/api/cron/prefetch` | ✅ |
| `l1-tts-generate.hurl` | P1 | `/api/tts/generate` | ✅ |
| `l1-admin-history.hurl` | P2 | `/api/admin/history` | ✅ |
| `l2-weaver-lab.hurl` | P2 | `/api/weaver/generate` | ✅ |
| `l2-ai-enrich.hurl` | P2 | `/api/ai/enrich` | ✅ |

## CI 集成

```yaml
# .github/workflows/test.yml
- name: Run Hurl Tests
  run: |
    hurl --variables-file tests/hurl.env --test tests/l1-*.hurl
```
