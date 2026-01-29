# LLM Prompt 评测架构设计 (LLM Prompt Evaluation Architecture)

## 1. 概述 (Overview)
本文档概述了 Opus 项目中用于评估 LLM 生成内容质量、稳定性和正确性的架构方案。
目标是从人工“目测”响应转变为系统化、自动化的验证流程（即 Prompt 的单元测试）。

## 2. 核心组件 (Core Components)

### 2.1. 测试工具 (`scripts/eval-prompts.ts`)
一个 CLI 工具，用于编排整个评测流程。
- **角色**: 测试运行器 (Test Runner)
- **输入**: 测试数据集 (JSON) + 生成器模式 (如 `L1_CHUNKING`)
- **动作**:
    1. 读取测试用例。
    2. 调用 Prompt 生成器 (如 `lib/generators`)。
    3. 发送 Prompt 给 LLM (使用 `workers/llm-failover`)。
    4. 针对预定义的标准验证响应结果。
- **输出**: 控制台报告 (Pass/Fail) + 日志文件。

### 2.2. 测试数据集 (`tests/evals/*.json`)
结构化的 JSON 文件，包含输入场景和预期标准。

**Schema 示例:**
```json
[
  {
    "id": "case_001",
    "description": "长难句应至少被切分为 3 个部分",
    "input": {
        // 传递给 Generator 函数的参数
        "sentence": "The quarterly financial report was delayed due to unexpected errors in the data processing pipeline."
    },
    "criteria": {
        // 断言 (Assertions)
        "minSegments": 3,
        "requiredTags": ["<s>", "<v>", "<o>"], // Syntax 模式示例
        "forbiddenWords": ["delayed"] // 负向约束示例
    }
  }
]
```

### 2.3. 评分器 (The Grader: Hybrid Approach)
我们采用 **规则校验 + LLM 裁判 (LLM-as-a-Judge)** 的混合评估策略。

#### A. 基础规则器 (Rule-Based Validator)
- **Schema 校验**: Zod 结构检查。
- **硬性约束**: 必须包含 3 个 chunk，必须是 S-V-O 结构等。

#### B. 对抗性角色裁判 (Adversarial Persona Judges)
使用强模型 (如 GPT-4o 或 Claude 3.5 Sonnet) 扮演特定角色，对输出进行定性打分。

**三大核心裁判角色 (The Triumvirate):**

1.  **ETS 出题委员会审计员 (The ETS Auditor)**
    -   **目标**: 评估业务语境 (L2) 和干扰项质量。
    -   **标准**: 拒绝像教科书的句子；拒绝不仅其微的干扰项。
    -   **Prompt**: "You are a Senior Content Auditor for ETS... REJECT any content that feels 'AI-generated'."

2.  **焦虑的备考程序员 (The Anxious Engineer)**
    -   **目标**: 评估解释 (L0/Explanation) 的清晰度和速度。
    -   **标准**: 必须在一眼（3秒）内看懂；拒绝晦涩的语言学术语。
    -   **Prompt**: "You are a Junior Software Engineer with a TOEIC score of 350... If you have to read it twice -> FAIL."

3.  **数据清洗专家 (The Data Sanitizer)**
    -   **目标**: 评估 ETL 脚本、1+N 选词、Word Family。
    -   **标准**: 0 幻觉；JSON 结构完美；多义词绝不混淆。
    -   **Prompt**: "You are a Lead Data Engineer... Ensure 99.9% data integrity."

## 3. 工作流 (Workflow)

```mermaid
graph TD
    A[Human/人工] -->|定义| B(测试数据集 .json)
    C[CLI 脚本] -->|读取| B
    C -->|调用| D[Prompt 生成器]
    D -->|生成| E(System + User Prompt)
    C -->|发送给| F[待测模型 (Gemini/DeepSeek)]
    F -->|返回| G(JSON 响应)
    C -->|第一道防线| H[Zod/Rule Validator]
    H -->|Pass| I[LLM 裁判 (GPT-4o)]
    I -->|Persona: ETS Auditor| J{打分/拒绝理由}
    I -->|Persona: Anxious Engineer| K{打分/拒绝理由}
    C -->|汇总| L[最终报告]
```

## 4. 目录结构

```text
root/
├── scripts/
│   └── eval-prompts.ts       # 测试运行器 (Test Runner)
├── tests/
│   └── evals/
│       ├── l0-syntax.json    # Level 0 Syntax 的测试用例
│       └── l1-chunking.json  # Level 1 Chunking 的测试用例
├── lib/
│   └── generators/           # 现有的 Prompt 生成器
│       ├── l0/
│       └── l1/
└── workers/
    └── drill-processor.ts    # 参考实现 (生产环境代码)
```

## 5. 第一阶段实施 (PoC)

**目标**: Level 1 Chunking (`L1_CHUNKING`)
**范围**:
1. 实现 `scripts/eval-prompts.ts`，包含基础的 Zod 验证。
2. 创建 `tests/evals/l1-chunking.json`，包含 5 个硬编码的测试示例。
3. 验证脚本能够成功运行并报告结果 (Pass/Fail)。

## 6.哪怕未来扩展 (Future Expansion)
- **CI 集成**: 在 Pull Requests 中运行评测。
- **回归测试**: 确保新的 Prompt 版本不会破坏旧的 Case。
- **数据集生成**: 使用 LLM 生成测试用例 (Meta-Evaluation)。
