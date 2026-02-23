import { z } from 'zod';

/**
 * 语法树打标 Prompt — 批量为 QuestionSeed 分配 L3 GrammarNode
 *
 * 设计要点：
 *   1. LLM 返回 code（人类可读的枚举），不返回 cuid（防幻觉）
 *   2. 批量模式，一次 10 题，效率提升 10 倍
 *   3. 允许 NULL，无法匹配时跳过
 */

// ---------------------------------------------------------------------------
// System Prompt (静态常量，符合 architecture-rules Prompt Separation)
// ---------------------------------------------------------------------------

export const GRAMMAR_TAGGER_SYSTEM_PROMPT = `你是 TOEIC 语法分析引擎。你的任务是为一批英语题目匹配最精准的语法考点节点 CODE。

## 规则
1. 从提供的【语法节点库】中选出与每道题考点最契合的叶子节点 CODE。
2. 如果没有匹配的节点，grammarNodeCode 填严格的字符串 "NULL"。
3. reason 用 15 字以内中文简述选择依据。
4. 一道题只能匹配一个节点，选最核心的考点。
5. 返回纯 JSON 数组，不要 markdown 标记。

## 判定优先级
- 词性变形题 → 优先在后缀节点 (NOUN_SUFFIX, ADJ_ADV_SUFFIX) 与 位置节点 (ADJ_ADV_POSITION) 中选择最契合的一项
- 时态语态题 → 优先看动词体系 (VERB_TENSE_*, VERB_VOICE_*)
- 连词介词辨析 → 优先看虚词连接 (PREP_VS_CONJUNCTION, CONJ_*)
- 固定搭配题 → 优先看 PREP_DEPENDENT 或 VERB_PATTERN_PHRASAL
- 从句引导词 → 优先看从句体系 (CLAUSE_*)
- **注意**：题型标为 SYNONYM 但解析中涉及"搭配"或特定介词时，仍应匹配搭配节点，禁止标 NULL

## 输出格式
[
  { "id": "题目ID", "grammarNodeCode": "NON_FINITE_GERUND", "reason": "have difficulty doing固定句型" },
  { "id": "题目ID", "grammarNodeCode": "NULL", "reason": "纯语境词义辨析" }
]`.trim();

// ---------------------------------------------------------------------------
// 构建 User Prompt 的工具函数
// ---------------------------------------------------------------------------

export interface TaxonomyNode {
    code: string;
    name: string;
    description: string | null;
}

export interface QuestionForTagging {
    id: string;
    sentence: string;
    targetAnswer: string;
    questionType: string;
    options: unknown;
    rationale: string;
}

/**
 * 构建批量打标的 User Prompt
 */
export function buildTaggerUserPrompt(
    taxonomyNodes: TaxonomyNode[],
    questions: QuestionForTagging[],
): string {
    const taxonomyBlock = taxonomyNodes
        .map(n => `- CODE: ${n.code} | ${n.name} | ${n.description ?? ''}`)
        .join('\n');

    const questionsBlock = questions
        .map((q, i) => {
            const optsArray = q.options as any[];
            const optsText = Array.isArray(optsArray)
                ? optsArray.map((o: any) => o.text).join(' / ')
                : JSON.stringify(q.options);
            return `【Q${i + 1}】ID=${q.id}\n题干: ${q.sentence}\n答案: ${q.targetAnswer}\n选项: ${optsText}\n题型: ${q.questionType}\n解析: ${q.rationale}`;
        })
        .join('\n\n');

    return `=== 语法节点库 ===\n${taxonomyBlock}\n==================\n\n=== 待分析题目 (共${questions.length}题) ===\n${questionsBlock}`;
}

// ---------------------------------------------------------------------------
// Zod Schema (强校验 LLM 输出)
// ---------------------------------------------------------------------------

export const GrammarTagResultItemSchema = z.object({
    id: z.string().describe('题目 ID，原封不动返回'),
    grammarNodeCode: z.string().describe('匹配的语法节点 CODE，如 VERB_TENSE_PERFECT。无匹配填 "NULL"'),
    reason: z.string().describe('20字以内中文简述'),
});

export const GrammarTagBatchResultSchema = z.array(GrammarTagResultItemSchema);

export type GrammarTagBatchResult = z.infer<typeof GrammarTagBatchResultSchema>;
