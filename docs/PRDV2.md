# Opus (Mobile) - Master PRD: The AI-Native Architecture

| 属性 | 内容 |
| --- | --- |
| **项目名称** | Opus (Mobile) |
| **版本** | **v3.0 (The Arena Release)** |
| **状态** | **Final Architecture Locked** |
| **核心理念** | **AI-Native** (生成式), **Zero-Wait** (零等待), **Multi-Track** (多轨记忆), **From Input to Output** (从输入到输出的跨越) |
| **技术重心** | **Next.js (Brain/Logic)** + **Python (Voice Renderer)** |
| **更新时间** | 2026-02-20 |

---

## 1. 产品愿景 (Vision)

Opus v3.0 是一个 **“生成优先 (Generator-First)”** 的系统。核心战略是：**“前端物理分离，后端灵魂暗合”**。我们将从单一的“背单词工具”，正式跨入**“TOEIC 全真闭环提分系统”**的领域。

我们不存储“死题目”，只存储“活种子”。每一次用户复习，都是 AI 根据用户当前的 FSRS 状态、记忆短板、TOEIC 考点要求，**JIT (Just-in-Time) 实时生成** 的全新体验。

**核心口号**: *You never step into the same drill twice.*

---

## 2. 技术架构 (Technical Architecture)

架构维持 **Next.js 全栈主导**，Python 为专用计算节点，只处理TTS音频。

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
| **Track C: Context** | **Task 3 (L2)** | **语境逻辑** | 决定是否生成 Context Lab/Arena 卡片（需调用 1+N）。 |

---

## 4. 交互与入口体系 (UX Structure)

为了降低用户的认知负担，v3.0 升级为极简的 **底部双 Tab 结构**，将“输入”（背诵）与“输出”（测试）物理隔离：

* **Tab 1: 🥋 The Dojo (道场 / 词汇输入)** - 专注于 L0/L1 基础建立
* **Tab 2: 🏟️ The Arena (竞技场 / 实战输出)** - 专注于 L2 实战检验

### 4.1 Tab 1: The Dojo (道场)

保持原有 v2.1 版本的所有核心功能：

#### 🔹 [主入口] Daily Blitz (智能混合流)
**位置**: 首页 Hero Section。
**逻辑**: **Zero-Decision (零决策)**。系统扫描所有轨道，自动混合 L0/L1 卡片。用户点击一次，即可进行全方位训练。

#### 🔹 [Task 1] Speed Run (L0 基础)
> **📄 详细设计文档**: [](docs/task1.md) (点击查看详情)
* **定位**: Foundation (基座层)。建立形义连接。
* **生成逻辑 (Next.js)**: 基于 FSRS 驱动的 **70/30 协议** (70% Review + 30% New)，实时生成 **SVO 微语境** 或 **词性陷阱**。

#### 🔹 [Task 1.5] Chunking Gym (L1.5 过渡)
> **📄 详细设计文档**: [](docs/TASK1.5.md) (点击查看详情)
* **定位**: Bridge-Prep (预腰部层)。连接"认字"与"长句"的关键过渡。
* **场景**: 语块排序 (Sentence Reordering)。

#### 🔹 [Task 2] Audio Gym (L1 进阶)
> **📄 详细设计文档**: [](docs/task2.md) (点击查看详情)
* **定位**: Bridge (腰部层)。盲听训练，情感语音。
* **生成逻辑**: Next.js 编剧 + Python 演播。

---

### 4.2 Tab 2: The Arena (竞技场) - *v3.0 新增核心*

The Arena 不是一个静态的“死题库”，它是一个 **“懂你的 AI 考官”**。引入 TOEIC Part 5/6/7 题型，打造“背-练-测”闭环。

#### 🔹 [架构挂载] Hybrid Selector (30/50/20 发牌协议)
不同于 The Dojo 纯基础复习的 70/30 协议，The Arena 的发牌引擎挂载于高阶的 `Hybrid Selector`，遵循更具挑战性的 30/50/20 配比“暗合”逻辑：
1. **Rescue (语法补救 / 30%)**：打捞处于底层挣扎的语法盲点词汇 (Visual < 30 或 Logic < 20)。
2. **Review (遗忘拦截 / 50%)**：抽取 FSRS 队列中面临遗忘临界点 (`Due`) 的单词，用实战做题代替机械闪卡复习。*(注：若 Rescue 队列未满，名额自动溢出至 Review)*
3. **New (融会贯通 / 20%)**：刚在 The Dojo 学习的新词，立即在实战中考察，带来最高的心流体验与应用成就感。

#### 🔹 模块一：Arena Dashboard (实战大厅)
* **动态战报 UI**：文案包装为职场任务风格（例: `"Briefing: 1 Active Mission"`），**严禁出现具体的待复习数字（Review Hell）以防触发用户焦虑。**
* **模式选择**：
  * ⚡ **Part 5 Blitz (单句闪电战)**：碎片时间 (3-5 分钟)。
  * 📜 **Part 6/7 Mission (阅读狙击战)**：大块时间 (10-15 分钟)。

#### 🔹 模块二：Part 5 Blitz (单句闪电战)
* **UI 呈现**：上方题干（带 `_______` 空白），下方 4 个选项按钮。**严禁倒计时组件 (Timer)。**
* **交互闭环**：
  1. 用户点击选项。触发红/绿颜色反馈 + 震动 `Haptics`。
  2. **无缝衔接 Magic Wand**：底部自动弹出魔法棒解析浮层（Rationale），用极简文字解释选项。
  3. 用户无压力前往下一题，后台**静默记录答题耗时**。

#### 🔹 模块三：Part 6/7 Mission (阅读狙击战) (演进自原 Context Lab/Weaver Lab)
* **Part 6 (段落完形)**：LLM 生成 150 字商务短文，挖词填空。
* **Part 7 (阅读理解)**：LLM 生成文档，底部附带阅读理解题（主旨/细节）。
* **Magic Wand 兼容**：继承划词解析能力，长按唤起句法分析。

#### 🔹 The Data Loop (数据回流机制 - 终极壁垒)
**做题等于背词**。在 The Arena 完成题目后：
1. **提取 `AnchorWord`**：识别测试核心词（如 `implement`）。
2. **映射 FSRS 评级**：
   * 选对且静默耗时短 -> `Easy/Good`，延长复习时间。
   * **选错 -> `Again/Hard`，降维打击！该单词被立即打回，明天在 Tab 1 (Dojo) 重新以卡片形式出现并接受安全降维学习。**
3. **写入审计日志 (Audit Log)**：记录 `PART5_ATTEMPT`，追踪错误偏好。

#### 🔹 The Dual-Track Engine (词汇与句法双轨并发)
> **📄 详细设计文档**: [语法诊断树 PRD](PRD-GRAMMAR-SKILL-TREE.md) (点击查看详情)
打破传统仅基于词汇的孤立记忆，建立 **FSRS 词汇轨** 与 **BKT (贝叶斯追踪) 句法轨** 并行的双层架构：
1. **L1-L3 语法树**：涵盖约 30 个 TOEIC 核心语法节点，过滤猜测噪声。
2. **靶向出题**：动态结合词汇薄弱点与语法薄弱点，实现精准刷题体验。
3. **JIT 微课干预**：针对低掌握度节点触发 Magic Wand 实时微课。

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

Opus v3.0 在基于 Next.js + Python 的高效单体架构之上，通过 **The Dojo (输入)** 与 **The Arena (输出)** 的物理切割，完美实现了认知负荷的控制与实战能力的提升。

* **The Dojo (Tab 1)**: 采用极简 70/30 FSRS 协议，负责低压力的知识捕获与记忆巩固。
* **The Arena (Tab 2)**: 采用高阶 30/50/20 混合发牌协议，负责应用闭环、盲点探测与 FSRS 状态回流。
