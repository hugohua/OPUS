# PWA 配置与部署文档

> **版本**: v1.0
> **更新日期**: 2026-02-18
> **状态**: 已上线

---

## 1. 概述

Opus 已启用 PWA (Progressive Web App) 支持，允许用户将应用安装到手机主屏幕，获得类原生应用体验。

**技术栈**: [Serwist](https://serwist.pages.dev/) (`@serwist/next` + `serwist`) — `next-pwa` 的现代化专业继任者。

**核心价值**:
- 降低访问门槛 → 提升回归率 → 契合 "Survive First" 原则
- iPhone Safari 支持"添加到主屏幕"
- Standalone 全屏模式，无浏览器地址栏

---

## 2. 文件结构

```text
├── app/
│   └── sw.ts                    # Service Worker 入口（源文件）
├── public/
│   ├── manifest.json            # Web App Manifest
│   ├── sw.js                    # [构建产物] 编译后的 SW（已 gitignore）
│   └── icons/
│       ├── icon-192.png         # Android 标准图标
│       ├── icon-512.png         # Android 大图标 / Splash
│       ├── icon-maskable-512.png # Android 自适应图标
│       └── apple-touch-icon.png  # iOS 主屏幕图标 (180x180)
├── next.config.mjs              # withSerwist 包装
└── .gitignore                   # 排除 public/sw.js 和 serwist-*.js
```

---

## 3. 关键配置说明

### 3.1 next.config.mjs

```javascript
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",       // SW 源文件路径
    swDest: "public/sw.js",   // SW 编译输出路径
    disable: process.env.NODE_ENV === "development", // 开发环境禁用
});

export default withSerwist(nextConfig);
```

### 3.2 构建命令

```json
{
  "build": "next build --webpack"
}
```

> [!IMPORTANT]
> Next.js 16 默认使用 Turbopack，但 Serwist 需要 webpack 编译 Service Worker。  
> 必须在 build 命令中加 `--webpack` 标志，否则构建报错 `Call retries were exceeded`。

### 3.3 layout.tsx — PWA 元数据

```typescript
// viewport 独立导出（Next.js 14+ 规范）
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",      // iPhone 安全区域适配
    themeColor: "#09090B",     // Zinc 950
};

// metadata 中的 PWA 相关字段
export const metadata: Metadata = {
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        title: "Opus",
        statusBarStyle: "black-translucent",
    },
};
```

### 3.4 Service Worker 缓存策略

`app/sw.ts` 使用 Serwist 的 `defaultCache` 策略：

| 资源类型 | 策略 | 说明 |
|:---------|:-----|:-----|
| 页面导航 | NetworkFirst | 优先网络，离线用缓存 |
| 静态资源 (`/_next/static/*`) | CacheFirst | 长期缓存，哈希变则 URL 变 |
| 图片/音频 | CacheFirst | 长缓存 |
| API 路由 (`/api/*`) | NetworkOnly | **绝不缓存** |
| Server Actions (非 GET) | NetworkOnly | **绝不缓存** |

---

## 4. 开发注意事项

### 开发环境
- Service Worker 在 `NODE_ENV === "development"` 时**自动禁用**
- 如需测试 PWA 功能，运行 `npm run build && npm start`

### 更换图标
1. 准备 512x512 以上的原始 PNG 图标
2. 使用 `sharp` 缩放：
   ```bash
   node -e "const s=require('sharp'); s('source.png').resize(192,192).toFile('public/icons/icon-192.png'); s('source.png').resize(512,512).toFile('public/icons/icon-512.png'); s('source.png').resize(180,180).toFile('public/icons/apple-touch-icon.png')"
   ```

### .gitignore
以下文件为构建产物，**不要提交到 Git**：
- `public/sw.js` / `public/sw.js.map`
- `public/serwist-*.js` / `public/serwist-*.js.map`

---

## 5. iPhone 安装指南

1. 用 Safari 打开 Opus 站点
2. 点击底部 **分享按钮** (方框+箭头)
3. 选择 **添加到主屏幕**
4. 应用以 Standalone 模式运行（无地址栏）

---

## 6. 故障排查

| 现象 | 原因 | 解决 |
|:-----|:-----|:-----|
| 构建报错 `Call retries were exceeded` | 未使用 `--webpack` 标志 | `package.json` 中 build 命令加 `--webpack` |
| iPhone 无法安装 | 缺少 `apple-touch-icon` | 确认 `public/icons/apple-touch-icon.png` 存在 |
| Chrome 无安装提示 | Manifest 图标尺寸不匹配 | 确保图标实际像素与 manifest 声明一致 |
| 页面内容过期 | SW 缓存未更新 | 重新构建部署，SW 版本会自动更新 |
