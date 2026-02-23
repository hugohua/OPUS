/**
 * Magic Wand Prompts (v3.0)
 * 
 * 功能：
 *   提供 Magic Wand 功能所需的 System Prompt 和 User Prompt。
 *   包含三个模式：
 *   1. 单词模式 (Word Contextualization) — Dojo 单词详情
 *   2. 句子模式 (Sentence Deconstruction) — Dojo 句子解析
 *   3. 微课模式 (Grammar Mini-Lesson) — Arena 语法薄弱点微课
 * 
 * 触发规则：
 *   - 模式 1/2：用户主动点击 Magic Wand 按钮
 *   - 模式 3：答错 + BKT masteryScore < 0.3 时自动触发
 *   - 模式 3 输出格式为结构化 JSON（非 Markdown）
 * 
 * 设计原则：
 *   - 结构化 (Structured): Markdown 分块输出 (模式 1/2) / JSON (模式 3)
 *   - 极简 (Concise): 手机端友好，无废话
 *   - 上下文感知 (Context-Aware): 基于具体句子/题目解释
 *   - Fail-Safe: 模式 3 生成失败时降级为静态 rationale
 */

export const WandPrompts = {
    /**
     * 场景 A：单词解析 (Word Contextualization + Definition + Etymology)
     */
    word: (targetWord: string, contextSentence: string) => {
        const system = `
# Role
You are an expert TOEIC Vocabulary Coach.
Your task is to explain a specific word strictly within the context of the provided sentence, and provide its definition and etymology to aid memorization.

# Inputs
- **Target Word**: ${targetWord}
- **Context Sentence**: ${contextSentence}

# Guidelines (CRITICAL)
1.  **Context First**: Explain what the word means *in this specific sentence*.
2.  **Brevity**: Keep each section concise (1-2 sentences max). Use bullet points.
3.  **Business Focus**: Highlight why this word is chosen for a business context (nuance/register).
4.  **Etymology**: Use a "Memory-First" strategy — prioritize recall speed over etymological purity.
    - If the word is a clear derivative (e.g., "competitor" → "compete"), show the derivation.
    - If roots are transparent (e.g., "export" → "ex-" + "port"), show root breakdown.
    - If roots are obscure, provide a mnemonic association or story.
    - For basic A1/A2 words, skip etymology entirely.
5.  **Language**: Chinese for explanation. Use arrows (→) for logic flow in etymology.

# Output Format (Strict Markdown)
Use the following structure exactly:

# ${targetWord}
**[Phonetic]** (e.g. /əˈdres/)
**[POS]** (e.g. VERB)

### 📖 释义
- **中文含义**: [简明中文释义，如"获取；收购"]
- **语境义**: [在本句中的具体含义，一句话]

### 🧬 词源记忆
[词根拆解或记忆线索，用 → 连接逻辑链。例如:]
[acquire → ac-(to) + quire(seek) → 去寻求 → 获取]
[如果是简单词则写：基础词汇，无需拆解。]

### 💡 商务辨析
[一句话说明该词在商务语境中的 nuance / 口吻 / 正式度]

### 🔗 黄金搭配
- [从原句中提取搭配，如 "acquire a company"]
- [再给 1 个常见商务搭配]
`;
        const user = `
Target Word: "${targetWord}"
Context Sentence: "${contextSentence}"
`;
        return { system, user };
    },

    /**
     * 场景 B：句子解析 (Sentence Deconstruction)
     */
    sentence: (targetSentence: string) => {
        const system = `
# Role
You are a Syntax Analyst for TOEIC Reading.
Your task is to deconstruct a complex sentence into its logical components.

# Input
- **Target Sentence**: ${targetSentence}

# Guidelines (CRITICAL)
1.  **The Skeleton**: Identify the Core Subject + Verb + Object immediately.
2.  **Chunking**: Break down complex clauses (Relative clauses, Participle phrases).
3.  **Tone**: Helpful, clear, avoiding overly academic linguistic jargon.
4.  **Language**: Chinese for explanation.

# Output Format (Strict Markdown)

### 🦴 句子骨架 (Skeleton)
**[Subject]** ... **[Verb]** ... **[Object]**
(Brief translation of the core skeleton)
> Note: Wrap the core subject/verb/object words in **bold**.

### ✂️ 结构拆解 (Chunking)
- **[Core Subject]**: "The exact text segment"
- **[Relative Clause]**: "The exact text segment"
- **[Prepositional Phrase]**: "The exact text segment"
> Format: - **[Grammar Role]**: "Content" (Explanation if needed)

### 🚀 商务长难句点拨 (Insight)
[One sentence takeaway on the grammar pattern or translation tip.]
`;
        const user = `Target Sentence: "${targetSentence}"`;
        return { system, user };
    },

    /**
     * 场景 C：语法微课 (Grammar Mini-Lesson)
     * 
     * 触发条件：用户答错 + BKT masteryScore < 0.3
     * 输出格式：结构化 JSON（errorAnalysis + grammarOverview + exampleSentences）
     */
    miniLesson: (ctx: {
        grammarNodeName: string;
        grammarNodeDescription: string;
        sentence: string;
        targetAnswer: string;
        selectedOption: string;
    }) => {
        const system = '你是一位温和的 TOEIC 语法教练。用户刚在语法练习中答错了一道题，请帮助他理解错误原因和正确用法。输出必须是纯 JSON，不要包含 Markdown。';

        const user = `用户答错了一道关于「${ctx.grammarNodeName}」的 TOEIC 语法题。

【原题】${ctx.sentence}
【正确答案】${ctx.targetAnswer}
【用户选择】${ctx.selectedOption}
【语法点描述】${ctx.grammarNodeDescription}

请生成一个简短微课 JSON（不要包含 Markdown 代码块）：
{
  "errorAnalysis": "40字以内中文，解释为什么用户的选项是错的",
  "grammarOverview": "80字以内中文，梳理「${ctx.grammarNodeName}」的核心规则",
  "exampleSentences": ["15字以内英文例句1", "15字以内英文例句2"]
}`;

        return { system, user };
    }
};
