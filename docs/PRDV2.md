# Opus (Mobile) - Master PRD: The AI-Native Architecture

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **v2.1 (The "Next.js-Core" Release)** |
| **状态** | **Final Architecture Locked** |
| **核心理念** | **AI-Native** (生成式), **Zero-Wait** (零等待), **Multi-Track** (多轨记忆) |
| **技术重心** | **Next.js (Brain/Logic)** + **Python (Voice Renderer)** |
| **更新时间** | 2026-01-29 |

---

## 1. 产品愿景 (Vision)

Opus v2.0 是一个 **“生成优先 (Generator-First)”** 的系统。
我们不存储“死题目”，只存储“活种子”。每一次用户复习，都是 AI 根据用户当前的 FSRS 状态、记忆短板、TOEIC 考点要求，**JIT (Just-in-Time) 实时生成** 的全新体验。

**核心口号**: *You never step into the same drill twice.*

---

## 2. 技术架构 (Technical Architecture)

架构调整为 **Next.js 全栈主导**，Python 为专用计算节点，只处理TTS音频。

### 2.1 核心分层

* **Core Brain (主脑): Next.js 14 (App Router)**
* **角色**: 全局调度器、逻辑处理器、AI 文本生成器。
* **职责**:
* **FSRS Engine**: 计算多轨记忆状态。
* **Shopper (TypeScript)**: 直接调用 Prisma/SQL 连接 `pgvector` 执行 1+N 向量搜索。
* **Chef (TypeScript)**: 通过 Vercel AI SDK / OpenAI SDK 调用 LLM 生成题目文本。
* **Mixer**: 聚合每日任务流。




* **Voice Renderer (声卡): Python (FastAPI)**
* **角色**: 纯粹的 TTS 渲染服务。
* **职责**: 接收 Next.js 发来的 `Text` + `Emotion Tag`，调用 CosyVoice 生成音频流，返回 URL 或二进制流。


* **Data Persistence (存储)**: **PostgreSQL**
* 存储 `Vocab`, `UserDrillProgress`, `Vectors`。



---

## 3. 核心算法：多轨制 FSRS (Multi-Track FSRS)

同一个单词在后台拥有三条独立的 FSRS 曲线，互不干扰：

| 轨道 (Track) | 对应任务 | 考核维度 | 决策含义 |
| --- | --- | --- | --- |
| **Track A: Visual** | **Task 1 (L0)** | **形义连接** | 决定是否生成 Speed Run 卡片。 |
| **Track B: Audio** | **Task 2 (L1)** | **听觉反射** | 决定是否生成 Audio Gym 卡片（需调用 Python）。 |
| **Track C: Context** | **Task 3 (L2)** | **语境逻辑** | 决定是否生成 Context Lab 卡片（需调用 1+N）。 |

---

## 4. 交互与入口体系 (UX Structure)

系统采用 **“1 + 3”** 结构：一个智能主入口，三个专项子文档。

### 4.1 主入口：Daily Blitz (智能混合流)

**位置**: 首页 Hero Section。
**逻辑**: **Zero-Decision (零决策)**。
系统扫描所有轨道，自动混合 L0/L1/L2 卡片。用户点击一次，即可进行全方位训练。

### 4.2 子入口：Skill Gym (专项训练馆)

下方区域允许用户查看详情或专项训练。点击标题可进入对应任务的详细设计文档。

#### 🔹 [Task 1] Speed Run (L0 基础)

> **📄 详细设计文档**: [](docs/task1.md) (点击查看详情)

* **定位**: Foundation (基座层)。
* **核心场景**: 快速刷词，建立形义连接。
* **生成逻辑 (Next.js)**: 基于 FSRS 参数，实时生成 **SVO 微语境** 或 **词性陷阱**。不涉及 Python 调用。

#### 🔹 [Task 2] Audio Gym (L1 进阶)

> **📄 详细设计文档**: [](docs/task2.md) (点击查看详情)

* **定位**: Bridge (腰部层)。
* **核心场景**: 盲听训练，情感语音。
* **生成逻辑 (Hybrid)**:
1. **Next.js**: 生成对话脚本 (Script) 和情感标签 (Emotion)。
2. **Python**: 接收脚本，**实时渲染** 高质量情感语音。



#### 🔹 [Task 3] Context Lab (L2 塔尖)

> **📄 详细设计文档**: [](docs/task3.md) (点击查看详情)

* **定位**: Apex (塔尖层)。
* **核心场景**: TOEIC Part 5/6 模拟，商务长难句填空。
* **生成逻辑 (Next.js)**:
1. **1+N 算法**: Next.js 直接查询 `pgvector` 抓取关联词。
2. **LLM**: Next.js 组装 Prompt 生成题目与苏格拉底解析。



---

## 5. 数据生产管线 (The Generation Pipeline)

### 5.1 数据流向 (Data Flow)

1. **Trigger**: 用户开始学习，Next.js 识别出 `Strategy` 需要复习。
2. **Routing (路由)**:
* 若是 **L0/L2 任务**: Next.js 内部闭环处理 (DB -> LLM -> Frontend)。
* 若是 **L1 任务**: Next.js 生成文本 -> **HTTP Request -> Python Service** -> 接收音频 -> Frontend。


3. **Delivery**: 前端接收统一格式的 JSON 数据渲染卡片。

### 5.2 兜底与预加载

* **L1 音频**: 由于涉及跨服务调用 (Next.js -> Python)，Next.js 需在队列中 **提前 2-3 个任务** 发起 TTS 请求，消除网络延迟。

---

## 6. 总结 (Summary)

Opus v2.1 回归了更高效的 **Next.js 单体优先** 架构，仅将计算密集型的 **TTS 语音生成** 外包给 Python。

* **Task 1 (Speed Run)**: 纯 Next.js 驱动，极致响应。
* **Task 2 (Audio Gym)**: Next.js 编剧 + Python 演播，体验最佳。
* **Task 3 (Context Lab)**: Next.js + pgvector 驱动，逻辑深沉。
