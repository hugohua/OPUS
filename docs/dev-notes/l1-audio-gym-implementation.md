# L1 Audio Gym Implementation Guide

> **Feature**: L1 Audio Gym (听觉反射训练)  
> **Status**: ✅ MVP Complete (Phase 4)  
> **Version**: 1.0.0  
> **Last Updated**: 2026-02-02

---

## 1. 产品定位

**L1 Audio Gym** 是 Opus Multi-Track FSRS 系统中的 **Track B (Audio)**，对应 PRD v2.1 的 Task 2。

### 核心目标
- **听觉反射训练**: 盲听单词，无视觉干扰
- **隐式评分 (Implicit Grading)**: 基于响应时长自动调整 FSRS 评分
- **Eyes-Free 体验**: 音频主导，最小化视觉依赖

---

## 2. 技术架构

### 2.1 系统分层

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js Client Component)   │
│  - AudioDrillCard.tsx (UI Shell)       │
│  - AudioSessionRunner.tsx (Logic)      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Backend (Next.js Server Actions)      │
│  - getAudioSession() [Queue Fetch]     │
│  - submitAudioGrade() [FSRS Update]    │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Intelligence (Python TTS Service)      │
│  - FastAPI @ localhost:8000            │
│  - DashScope TTS Rendering             │
└─────────────────────────────────────────┘
```

### 2.2 数据流

```mermaid
sequenceDiagram
    participant U as User
    participant UI as AudioSessionRunner
    participant SA as Server Action
    participant DB as Prisma
    participant TTS as Python TTS
    
    U->>UI: 访问 /drill/audio
    UI->>SA: getAudioSession()
    SA->>DB: Query AUDIO Track Due Words
    DB-->>SA: Return Queue (20 Items)
    SA-->>UI: AudioSessionData
    
    UI->>TTS: useTTS.play(word, voice)
    TTS->>DB: Check TTSCache
    alt Cache Hit
        DB-->>TTS: Return Audio URL
    else Cache Miss
        TTS->>TTS: Call DashScope API
        TTS->>DB: Write TTSCache
        TTS-->>UI: Return Audio URL
    end
    
    U->>UI: Grade (Forgot/Got it)
    UI->>SA: submitAudioGrade(vocabId, grade, duration)
    SA->>DB: Update FSRS (AUDIO Track)
    DB-->>SA: Success
    SA-->>UI: Next Item
```

---

## 3. 核心实现

### 3.1 Frontend UI (`components/drill/audio-drill-card.tsx`)

**设计原则: Eyes-Free**
- **Zone A (Stimulus)**: 
  - Waveform 动画（播放时脉冲）
  - 单词/音标/释义仅在 "Reveal" 后显示
- **Zone B (Interaction)**:
  - Recall Phase: "Reveal" 按钮 + "Replay" 按钮
  - Reveal Phase: "Forgot" / "Got it" 二元选择

**关键特性**:
- 复用 `UniversalCard` shell（一致性）
- `framer-motion` 动画（Premium 感）
- 无过度 `useEffect`（性能优化）

### 3.2 Session Logic (`components/session/audio-session-runner.tsx`)

**状态管理**:
```typescript
interface QueueItem {
    id: string;        // UserProgress ID
    vocabId: number;   // Vocab ID
    word: string;
    phonetic?: string;
    definition?: string;
    voice: string;     // TTS Voice (Cherry, Ethan, etc.)
}

const [queue, setQueue] = useState<QueueItem[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [isLoading, setIsLoading] = useState(true);
```

**自动播放逻辑**:
```typescript
useEffect(() => {
    if (!currentItem || !isSessionActive || isLoading) return;
    
    startTimeRef.current = Date.now(); // 计时开始
    
    tts.play({
        text: currentItem.word,
        voice: currentItem.voice,
        speed: 1.0
    });
}, [currentIndex, currentItem, isLoading]);
```

**隐式评分**:
```typescript
const handleGrade = async (grade: 1 | 2 | 3 | 4) => {
    const duration = Date.now() - startTimeRef.current;
    
    await submitAudioGrade({
        vocabId: currentItem.vocabId,
        grade,
        duration // Backend 根据 duration 微调 FSRS 评分
    });
};
```

### 3.3 Server Actions (`actions/audio-session.ts`)

#### 3.3.1 获取训练队列
```typescript
export async function getAudioSession(): Promise<ActionState<AudioSessionData>> {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');
    
    const candidates = await prisma.userProgress.findMany({
        where: {
            userId: session.user.id,
            track: 'AUDIO',  // ⚠️ 关键：AUDIO Track 隔离
            status: { in: ['LEARNING', 'REVIEW', 'NEW'] },
            next_review_at: { lte: new Date() } // 严格到期
        },
        include: {
            vocab: {
                select: {
                    id: true,
                    word: true,
                    phoneticUs: true,
                    phoneticUk: true,
                    definition_cn: true,
                    frequency_score: true,
                }
            }
        },
        orderBy: [
            { vocab: { frequency_score: 'desc' } }, // 热词优先
            { next_review_at: 'asc' },              // 逾期优先
        ],
        take: 20 // Session Batch Size
    });
    
    // Transform to AudioSessionItem
    const items = candidates.map(p => ({
        id: p.id,
        vocabId: p.vocab.id,
        word: p.vocab.word,
        phonetic: p.vocab.phoneticUs || p.vocab.phoneticUk,
        definition: p.vocab.definition_cn,
        voice: 'Cherry', // TODO: 根据单词特性选择音色
    }));
    
    return { status: 'success', data: { sessionId: crypto.randomUUID(), items } };
}
```

#### 3.3.2 提交评分
```typescript
export async function submitAudioGrade(
    input: SubmitAudioGradeInput
): Promise<ActionState<any>> {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');
    
    // 复用 recordOutcome，自动映射为 AUDIO Track
    return await recordOutcome({
        userId: session.user.id,
        vocabId: input.vocabId,
        grade: input.grade,
        mode: 'AUDIO', // ⚠️ 关键：mode -> track 映射
        duration: input.duration,
    });
}
```

### 3.4 TTS 集成

**Hook**: `hooks/use-tts.ts`
- 调用 `/api/tts/generate` API Route
- 内存缓存（避免重复网络请求）
- 错误处理（Toast 提示）

**Python 服务**: `python_tts_service/`
- **无状态**: 不连接数据库
- **纯计算**: 接收 `text + voice`，返回音频 URL
- **健康检查**: `GET /health` 端点

---

## 4. Multi-Track FSRS 集成

### 4.1 Track 定义
| Track | 对应任务 | 考核维度 | 评分字段 |
|-------|---------|---------|---------|
| VISUAL | L0 Speed Run | 形义连接 | `dim_v_score` |
| **AUDIO** | **L1 Audio Gym** | **听觉反射** | **`dim_a_score`** |
| CONTEXT | L2 Context Lab | 语境逻辑 | `dim_x_score` |

### 4.2 数据隔离
```typescript
// UserProgress 复合唯一键
@@unique([userId, vocabId, track])
```

**示例**:
```
userId: clxxx, vocabId: 123, track: AUDIO   -> Entry 1
userId: clxxx, vocabId: 123, track: VISUAL  -> Entry 2
```

两条记录独立维护 FSRS 状态（`stability`, `difficulty`, `next_review_at`）。

### 4.3 隐式评分逻辑
```typescript
// lib/algorithm/grading.ts
export function calculateImplicitGrade(
    baseGrade: number,
    duration: number,
    isRetry: boolean,
    mode: string
): number {
    if (baseGrade === 1) return 1; // Fail 不微调
    
    // Pass (3/4) 根据时长微调
    if (duration < 1500) return 4;  // < 1.5s -> Easy
    if (duration < 5000) return 3;  // 1.5s-5s -> Good
    return 2;                       // > 5s -> Hard
}
```

---

## 5. 测试策略

### 5.1 单元测试 (`actions/__tests__/audio-session.test.ts`)

**覆盖范围**:
- ✅ Happy Path: 返回到期的 AUDIO Track 单词
- ✅ Edge Case: 空队列（无到期单词）
- ✅ Track 隔离: AUDIO/VISUAL 独立性
- ✅ 评分更新: FSRS Stability 增加验证
- ✅ Schema 验证: AudioSessionItem 结构

**测试数据约定**:
```typescript
const TEST_USER_ID = 'clq2w3e4r5t6y7u8i9o0p1a3b';
const TEST_VOCABS = ['abroad', 'accept', 'affect'];
```

### 5.2 API 集成测试 (`tests/l1-tts-generate.hurl`)

**测试用例**:
1. **Test 1**: 基础 TTS 生成 (Happy Path)
2. **Test 2**: 缓存命中验证
3. **Test 3**: 缺少必需参数 (400 错误)

**已知问题**:
- ⚠️ Test 3 超时（5分钟），需要修复 Route Handler 的输入校验

---

## 6. 架构审计结论

### 评分摘要
| 维度 | 评分 | 说明 |
|------|------|------|
| **架构规范** | ⭐⭐⭐⭐⭐ | 完美符合 Brain-Worker Separation |
| **AI 体验** | ⭐⭐⭐⭐☆ | TTS 缓存优秀，建议加 Skeleton Loading |
| **业务对齐** | ⭐⭐⭐⭐⭐ | 精准实现 Multi-Track FSRS |
| **数据完整性** | ⭐⭐⭐⭐⭐ | FSRS 原子更新，Track 隔离成功 |

### Highlights
- 🟢 Brain-Worker Separation 完美实现
- 🟢 Multi-Track FSRS 隔离成功
- 🟢 TTS 缓存 + Failover 机制
- 🟢 Implicit Grading 正确实现

### Warnings
- 🟡 缺少 Optimistic UI (Loading Skeleton)
- 🟡 `useEffect` 依赖优化 (`tts.play` 去除)
- 🟡 `UserProgress.track` 字段缺少索引
- 🟡 集成测试需要 Mock `auth()`

**总体评价**: 🟢 **APPROVED FOR PRODUCTION**

---

## 7. 文件清单

### 新增文件
```
components/drill/audio-drill-card.tsx          # UI Component (Eyes-Free)
components/session/audio-session-runner.tsx    # Session Logic
app/drill/audio/page.tsx                       # Entry Point
actions/audio-session.ts                       # Server Actions
actions/__tests__/audio-session.test.ts        # Unit Tests
```

### 修改文件
```
python_tts_service/api/models.py               # Voice Validation (49 voices)
python_tts_service/api/routes.py               # Health Check Endpoint
```

---

## 8. 相关文档

| Topic | File |
|-------|------|
| **TTS 架构** | `docs/dev-notes/tts-architecture.md` |
| **Multi-Track FSRS** | `docs/dev-notes/phase2-architecture-summary.md` |
| **UI 设计** | `docs/ui-rules.md` |
| **测试规范** | `.agent/rules/testing-protocol.md` |
| **架构审计** | `brain/.../audit_report.md` (Artifact) |

---

## 9. 下一步

### Phase 5: 三轨呈现 (Dashboard Visualization)
- [ ] 单词详情页添加 VISUAL/AUDIO/CONTEXT 三轨掌握度可视化
- [ ] 雷达图或进度条展示各维度分数
- [ ] 点击维度跳转至对应训练入口

### 技术债务
- [ ] 添加 `AudioDrillCardSkeleton` Loading 组件
- [ ] 修复 `useEffect` 依赖警告
- [ ] 添加 Prisma 索引: `@@index([userId, track, next_review_at])`
- [ ] 完善 Hurl 测试的错误处理断言

---

**Author**: Opus Chief Architect  
**Date**: 2026-02-02  
**Version**: Phase 4 MVP
