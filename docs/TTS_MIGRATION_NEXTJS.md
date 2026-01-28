# TTS 功能迁移方案：React → Next.js 14+ App Router

## 📌 项目概况

**源架构 (Source)**:
- **框架**: React 18 + Webpack
- **TTS Provider**: 阿里云 DashScope Qwen3-TTS-Flash
- **传输**: Python FastAPI WebSocket (流式) + Node.js Express (REST API)
- **缓存**: MD5 Hash + 三层缓存（内存/LocalStorage/磁盘）

**目标架构 (Target: Opus)**:
- **框架**: Next.js 14+ (App Router)
- **后端**: Server Actions + Route Handlers
- **UI**: Shadcn UI + Tailwind CSS
- **状态**: React Hooks (Client Components)

---

## 🎯 迁移核心原则

> [!IMPORTANT]
> ### 🚫 迁移禁区
> 1. **禁止直接copy源码** - `useEffect`逻辑需要现代化改造
> 2. **禁止全局状态管理** - 不使用Redux/Mobx，采用React Context或本地状态
> 3. **严格TypeScript** - 所有接口必须有类型定义

> [!NOTE]
> ### ✅ 保留策略
> - **缓存机制** - MD5 Hash + 三层缓存完整保留
> - **Stream-and-Save** - 边播边存策略继续使用
> - **连接复用** - WebSocket连接池机制
> - **播放互斥** - 防止多音频重叠播放

---

## 📂 文件结构设计

```
opus/
├── app/
│   └── api/
│       └── tts/
│           ├── route.ts              # POST /api/tts (生成/流式)
│           └── check/[hash]/route.ts # GET /api/tts/check/:hash (缓存检查)
├── actions/
│   └── tts.ts                        # Server Actions (可选)
├── hooks/
│   └── use-tts.ts                    # 客户端TTS Hook 🔥
├── components/
│   ├── tts-player.tsx                # UI组件 (Shadcn风格)
│   └── tts-button.tsx                # 播放按钮
├── lib/
│   ├── tts/
│   │   ├── client.ts                 # WebSocket客户端逻辑
│   │   ├── cache.ts                  # 缓存管理
│   │   └── hash.ts                   # Hash生成工具
│   └── utils.ts
├── types/
│   └── tts.ts                        # TypeScript类型定义
└── python_tts_service/               # ⚠️ 保持不变（或迁移到Lambda/Cloud Functions）
    └── main.py
```

---

## 🔧 实现步骤

### Step 1: 提取核心逻辑

#### 1.1 识别TTS Provider
- **Provider**: 阿里云 DashScope (`qwen3-tts-flash`)
- **API调用位置**: `python_tts_service/main.py`
- **认证**: 通过 `process.env.OPENAI_API_KEY` (实际是阿里云Key)

#### 1.2 缓存机制分析

**现有三层缓存** (源码: `useAliyunAudio.js:488-543`):

```javascript
// 1️⃣ 内存缓存 (Map)
const audioAvailabilityCache = new Map(); 

// 2️⃣ 持久化缓存 (LocalStorage)
let persistentCacheStatus = AudioCacheStorage.load();

// 3️⃣ 磁盘缓存 (文件系统)
// 通过 /api/audio/check/:hash API检查
```

**Hash生成逻辑** (必须与前端一致):
```javascript
// 源码: python_tts_service/main.py:110
const hash_input = `${text}_${voice}_${language}_1.0`;
const audio_hash = hashlib.md5(hash_input.encode()).hexdigest();
```

---

### Step 2: 后端实现 (Next.js App Router)

#### 📄 `app/api/tts/route.ts` - 主要API

**功能**: 接收文本 → 检查缓存 → 调用Provider → 返回音频URL或流

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateAudioHash } from '@/lib/tts/hash';
import { checkCache, saveToCache } from '@/lib/tts/cache';
import { callDashScopeTTS } from '@/lib/tts/provider';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'Cherry', language = 'Chinese' } = await request.json();

    // 1. 生成Hash
    const hash = generateAudioHash(text, voice, language);

    // 2. 检查缓存
    const cached = await checkCache(hash);
    if (cached) {
      return NextResponse.json({
        success: true,
        url: `/audio/${hash}.wav`,
        duration: cached.duration,
        cached: true,
      });
    }

    // 3. 调用阿里云TTS (通过Python微服务或直接调用)
    const audioBuffer = await callDashScopeTTS(text, voice, language);

    // 4. 保存到磁盘和数据库
    await saveToCache(hash, audioBuffer, text, voice, language);

    return NextResponse.json({
      success: true,
      url: `/audio/${hash}.wav`,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

> [!WARNING]
> ### 🔐 安全注意事项
> - **API Key**: 必须使用 `process.env.DASHSCOPE_API_KEY`，禁止硬编码
> - **Rate Limiting**: 需添加请求频率限制，防止滥用
> - **文本长度限制**: 单次请求最大500字符（与源码一致）

#### 📄 `app/api/tts/check/[hash]/route.ts` - 缓存检查

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkCache } from '@/lib/tts/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  const cached = await checkCache(params.hash);
  
  if (cached) {
    return NextResponse.json({
      exists: true,
      url: `/audio/${params.hash}.wav`,
      duration: cached.duration,
    });
  }

  return NextResponse.json({ exists: false });
}
```

---

### Step 3: 前端Hook实现

#### 📄 `hooks/use-tts.ts` - 核心Hook 🔥

**API设计**:
```typescript
interface UseTTSOptions {
  text: string;
  autoPlay?: boolean;
  voice?: string;
  language?: string;
}

interface UseTTSReturn {
  play: () => void;
  stop: () => void;
  prefetch: () => Promise<void>;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  progress: number; // 0-100
  currentTime: number;
  duration: number;
}

function useTTS(options: UseTTSOptions): UseTTSReturn;
```

**实现要点**:

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { generateAudioHash } from '@/lib/tts/hash';
import { AudioCacheManager } from '@/lib/tts/cache';

// 🔥 全局播放互斥
let globalStopFunction: (() => void) | null = null;

export function useTTS({ text, autoPlay = false, voice, language }: UseTTSOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheManager = useRef(new AudioCacheManager());

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    
    // 清除全局引用
    if (globalStopFunction === stop) {
      globalStopFunction = null;
    }
  }, []);

  const play = useCallback(async () => {
    if (!text) return;

    // 🔥 停止其他正在播放的音频
    if (globalStopFunction && globalStopFunction !== stop) {
      globalStopFunction();
    }
    globalStopFunction = stop;

    setIsLoading(true);
    setError(null);

    try {
      const hash = generateAudioHash(text, voice, language);

      // 1️⃣ 检查内存缓存
      const memCached = cacheManager.current.getFromMemory(hash);
      if (memCached) {
        playAudio(memCached.url);
        return;
      }

      // 2️⃣ 检查LocalStorage缓存
      const lsCached = cacheManager.current.getFromLocalStorage(hash);
      if (lsCached) {
        playAudio(lsCached.url);
        cacheManager.current.saveToMemory(hash, lsCached);
        return;
      }

      // 3️⃣ 请求后端API
      const response = await fetch('/api/tts/check/' + hash);
      const data = await response.json();

      if (data.exists) {
        playAudio(data.url);
        cacheManager.current.saveToMemory(hash, data);
        cacheManager.current.saveToLocalStorage(hash, data);
      } else {
        // 生成新音频
        const genResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, language }),
        });
        const genData = await genResponse.json();
        playAudio(genData.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '播放失败');
      setIsLoading(false);
    }
  }, [text, voice, language, stop]);

  const playAudio = (url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setIsLoading(false);
      audio.play();
    };

    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => stop();
    audio.onerror = () => setError('音频加载失败');

    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
  };

  // 🔥 AutoPlay支持
  useEffect(() => {
    if (autoPlay && text) {
      play();
    }
    return () => stop();
  }, [text, autoPlay]);

  return { play, stop, isPlaying, isLoading, error, progress };
}
```

> [!TIP]
> ### 🎨 现代化改造要点
> 1. **移除冗余useEffect** - 仅在autoPlay场景使用
> 2. **使用useCallback** - 防止不必要的重新渲染
> 3. **TypeScript严格模式** - 所有类型必须显式声明
> 4. **useRef管理音频** - 避免状态更新导致重新创建Audio对象

---

### Step 4: UI组件实现

#### 📄 `components/tts-button.tsx` - Shadcn风格按钮

```typescript
'use client';

import { Volume2, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTTS } from '@/hooks/use-tts';
import { cn } from '@/lib/utils';

interface TTSButtonProps {
  text: string;
  voice?: string;
  language?: string;
  className?: string;
}

export function TTSButton({ text, voice, language, className }: TTSButtonProps) {
  const { play, stop, isPlaying, isLoading } = useTTS({ text, voice, language });

  const Icon = isLoading ? Loader2 : isPlaying ? Square : Volume2;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => (isPlaying ? stop() : play())}
      className={cn('transition-all', isLoading && 'cursor-wait', className)}
      disabled={!text}
    >
      <Icon className={cn('h-5 w-5', isLoading && 'animate-spin')} />
      <span className="sr-only">{isPlaying ? '停止播放' : '播放语音'}</span>
    </Button>
  );
}
```

#### 📄 `components/tts-player.tsx` - 完整播放器

```typescript
'use client';

import { useTTS } from '@/hooks/use-tts';
import { Progress } from '@/components/ui/progress';
import { TTSButton } from './tts-button';

interface TTSPlayerProps {
  text: string;
  autoPlay?: boolean;
}

export function TTSPlayer({ text, autoPlay = false }: TTSPlayerProps) {
  const { isPlaying, isLoading, error, progress, prefetch } = useTTS({
    text,
    autoPlay,
  });

  if (error) {
    return <div className="text-sm text-destructive">播放失败: {error}</div>;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <TTSButton text={text} />
      <div className="flex-1">
        <Progress value={progress} className="h-2" />
        <p className="mt-1 text-xs text-muted-foreground">
          {isLoading ? '加载中...' : isPlaying ? '播放中' : '就绪'}
        </p>
      </div>
    </div>
  );
}
```

---

### Step 5: 工具函数库

#### 📄 `lib/tts/hash.ts` - Hash生成

```typescript
import crypto from 'crypto';

export function generateAudioHash(
  text: string,
  voice: string = 'Cherry',
  language: string = 'Chinese'
): string {
  // ⚠️ 必须与Python后端逻辑一致
  const hashInput = `${text}_${voice}_${language}_1.0`;
  return crypto.createHash('md5').update(hashInput).digest('hex');
}
```

#### 📄 `lib/tts/cache.ts` - 缓存管理

```typescript
export class AudioCacheManager {
  private memoryCache = new Map<string, CacheEntry>();

  getFromMemory(hash: string): CacheEntry | null {
    return this.memoryCache.get(hash) || null;
  }

  saveToMemory(hash: string, entry: CacheEntry): void {
    this.memoryCache.set(hash, entry);
  }

  getFromLocalStorage(hash: string): CacheEntry | null {
    try {
      const stored = localStorage.getItem(`tts_cache_${hash}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  saveToLocalStorage(hash: string, entry: CacheEntry): void {
    localStorage.setItem(`tts_cache_${hash}`, JSON.stringify(entry));
  }
}

interface CacheEntry {
  url: string;
  duration: number;
}
```

---

## 🚀 部署策略

### Option A: 保留Python微服务 (推荐)

**优势**: 无需重写TTS调用逻辑，稳定可靠

```
Next.js App ──HTTP/WebSocket──→ Python FastAPI (port:8000)
                                 └─→ 阿里云 DashScope
```

**配置**:
```typescript
// next.config.js
module.exports = {
  rewrites: async () => [
    {
      source: '/ws/tts',
      destination: 'http://localhost:8000/ws/tts',
    },
  ],
};
```

### Option B: 完全迁移到Next.js

**挑战**: 需要在Node.js中调用阿里云SDK

```typescript
// lib/tts/provider.ts
import { MultiModalConversation } from '@alicloud/dashscope';

export async function callDashScopeTTS(text: string, voice: string) {
  const response = await MultiModalConversation.call({
    model: 'qwen3-tts-flash',
    text,
    voice,
    stream: true,
  });
  // ... 处理流式响应
}
```

---

## ✅ 验证清单

- [ ] Hash生成逻辑与源码一致
- [ ] 三层缓存全部正常工作
- [ ] 播放互斥机制（单实例播放）
- [ ] WebSocket连接复用（如使用）
- [ ] 长文本自动分块（500字符）
- [ ] 无障碍支持（ARIA标签）
- [ ] TypeScript无类型错误
- [ ] 性能优化：预加载、懒加载

---

## 📚 类型定义示例

#### 📄 `types/tts.ts`

```typescript
export interface TTSConfig {
  voice: string;
  language: string;
  playbackRate?: number;
}

export interface TTSResponse {
  success: boolean;
  url?: string;
  duration?: number;
  cached?: boolean;
  error?: string;
}

export interface CacheEntry {
  url: string;
  duration: number;
  timestamp: number;
}

export type TTSProvider = 'dashscope' | 'openai' | 'azure';

export interface TTSRequest {
  text: string;
  voice?: string;
  language?: string;
  provider?: TTSProvider;
}
```

---

## 🎯 下一步行动

1. **审阅本方案** - 确认架构设计符合业务需求
2. **确定部署方式** - 选择 Option A (保留Python) 或 Option B (完全迁移)
3. **创建TypeScript类型** - 优先完成 `types/tts.ts`
4. **实现核心Hook** - `hooks/use-tts.ts` (最关键)
5. **构建UI组件** - Shadcn风格的按钮和播放器
6. **编写测试** - 单元测试 + E2E测试

---

## 📞 需要澄清的问题

1. **目标项目是否已存在？** 还是从零开始创建Next.js项目？
2. **是否需要保留WebSocket流式播放？** 还是简化为HTTP API？
3. **Shadcn UI** 是否已安装？需要我提供安装命令吗？
4. **"Infinite Stream"上下文** 是什么？是否类似Tinder的卡片滑动？需要特殊的自动播放策略吗？
