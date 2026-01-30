
/**
 * 评估样本生成脚本 (Prompt Eval Generator)
 * 
 * 功能：
 *   1. 从数据库获取真实词汇 (优先 TOEIC 核心词)。
 *   2. 分批次调用 LLM 生成 L0/L1/L2 等级的 Prompt 和 Result。
 *   3. L0 包含三个变体：Syntax, Phrase, Blitz。
 *   4. 生成包含 "System Prompt", "User Prompt", "Result" 及 "人工评估指令" 的 Markdown 报告。
 * 
 * 使用方法：
 *   npx tsx scripts/generate-eval-samples.ts [options]
 * 
 * 参数：
 *   --limit=N    单次生成的单词数量 (默认: 5)。
 *   --level=N    指定生成等级: 0, 1, 2, all (默认: all)。
 *   --variant=V  指定等级下的具体变体 (默认: all):
 *                - syntax, phrase, blitz (L0)
 *                - chunking (L1)
 *                - context (L2)
 *   --model=TYPE 指定使用的 AI 模型场景:
 *                - default: 使用标准模型 (如 qwen-plus)
 *                - etl:     使用 ETL 专用模型 (如 gemini-flash)
 *   --out=DIR    输出目录 (默认: reports)。
 * 
 * 示例：
 *   # 1. 基础用法 (默认模型, L0, 10个样本)
 *   npx tsx scripts/generate-eval-samples.ts --limit=10 --level=0
 *
 *   # 2. 仅生成 L0 的 Phrase 变体
 *   npx tsx scripts/generate-eval-samples.ts --limit=10 --level=0 --variant=phrase
 * 
 *   # 3. 使用 ETL 模型生成 5 个 L1 样本
 *   npx tsx scripts/generate-eval-samples.ts --limit=5 --level=1 --model=etl
 */
import { PrismaClient } from '@prisma/client';
import { getL0SyntaxBatchPrompt } from '../lib/generators/l0/syntax';
import { getL0PhraseBatchPrompt } from '../lib/generators/l0/phrase';
import { getL0BlitzBatchPrompt } from '../lib/generators/l0/blitz';
import { getL1ChunkingBatchPrompt } from '../lib/generators/l1/chunking';
import { getL2ContextBatchPrompt } from '../lib/generators/l2/context';
import { generateText } from 'ai';
import { getAIModel, AIScenario } from '../lib/ai/client';
import fs from 'fs/promises';
import path from 'path';

// Parse args
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5;
const outDirArg = args.find(a => a.startsWith('--out='));
const outDir = outDirArg ? outDirArg.split('=')[1] : 'reports';
const levelArg = args.find(a => a.startsWith('--level='));
const level = levelArg ? levelArg.split('=')[1] : 'all'; // '0', '1', '2', 'all'
const modelArg = args.find(a => a.startsWith('--model='));
const modelScenario = (modelArg && modelArg.split('=')[1] === 'etl') ? 'etl' : 'default';
const variantArg = args.find(a => a.startsWith('--variant='));
const variant = variantArg ? variantArg.split('=')[1].toLowerCase() : 'all'; // 'syntax', 'phrase', 'blitz', 'chunking', 'context', 'all'

const prisma = new PrismaClient();

async function main() {
    await fs.mkdir(outDir, { recursive: true });

    console.log(`Generating samples for level: ${level}, limit: ${limit}`);
    console.log(`Selected Model Scenario: ${modelScenario.toUpperCase()}`);
    if (variant !== 'all') console.log(`Selected Variant: ${variant.toUpperCase()}`);

    // 1. Fetch Words (TOEIC core first)
    let words = await prisma.vocab.findMany({
        where: { is_toeic_core: true },
        take: limit,
    });

    if (words.length < limit) {
        console.log(`Found only ${words.length} TOEIC core words. Fetching more...`);
        const needed = limit - words.length;
        const anyWords = await prisma.vocab.findMany({
            where: { id: { notIn: words.map(w => w.id) } },
            take: needed
        });
        words.push(...anyWords);
    }

    // Use 'default' or 'etl' scenario based on args
    const { model, modelName } = getAIModel(modelScenario);
    console.log(`--------------------------------------------------`);
    console.log(`🚀 USING AI MODEL: [${modelName}]`);
    console.log(`--------------------------------------------------`);

    // Prepare inputs for each level
    const l0SyntaxInputs: any[] = [];
    const l0PhraseInputs: any[] = [];
    const l0BlitzInputs: any[] = [];
    const l1Inputs: any[] = [];
    const l2Inputs: any[] = [];

    for (const word of words) {
        const family = (word.word_family as Record<string, string>) || {};

        // L0 Variants Input
        if (level === 'all' || level === '0') {
            const randomWords = await prisma.vocab.findMany({
                take: 3, // Increased for phrase modifiers
                skip: Math.floor(Math.random() * 100),
                where: { id: { not: word.id } }
            });
            const randomList = randomWords.map(w => w.word);

            // 1. Syntax (S-V-O)
            if (variant === 'all' || variant === 'syntax') {
                l0SyntaxInputs.push({
                    targetWord: word.word,
                    meaning: word.definition_cn || 'No definition',
                    contextWords: randomList.slice(0, 2),
                    wordFamily: family
                });
            }

            // 2. Phrase (1+N modifiers)
            if (variant === 'all' || variant === 'phrase') {
                l0PhraseInputs.push({
                    targetWord: word.word,
                    modifiers: randomList.slice(0, 1) // Mock modifiers
                });
            }

            // 3. Blitz (Collocations)
            if (variant === 'all' || variant === 'blitz') {
                l0BlitzInputs.push({
                    targetWord: word.word,
                    meaning: word.definition_cn || '',
                    collocations: randomList // Mock collocations
                });
            }
        }

        // L1 Input
        if (level === 'all' || level === '1') {
            if (variant === 'all' || variant === 'chunking') {
                if (word.commonExample) {
                    l1Inputs.push({
                        sentence: word.commonExample,
                        targetWord: word.word
                    });
                }
            }
        }

        // L2 Input
        if (level === 'all' || level === '2') {
            if (variant === 'all' || variant === 'context') {
                const randomWords = await prisma.vocab.findMany({
                    take: 3,
                    skip: Math.floor(Math.random() * 100),
                    where: { id: { not: word.id } }
                });
                l2Inputs.push({
                    targetWord: word.word,
                    contextWords: randomWords.map(w => w.word)
                });
            }
        }
    }

    // Execute Batch Generation

    // L0 Variants
    if (l0SyntaxInputs.length > 0) {
        const prompts = getL0SyntaxBatchPrompt(l0SyntaxInputs);
        await runBatch('0-Syntax', prompts, model);
    }
    if (l0PhraseInputs.length > 0) {
        const prompts = getL0PhraseBatchPrompt(l0PhraseInputs);
        await runBatch('0-Phrase', prompts, model);
    }
    if (l0BlitzInputs.length > 0) {
        const prompts = getL0BlitzBatchPrompt(l0BlitzInputs);
        await runBatch('0-Blitz', prompts, model);
    }

    if (l1Inputs.length > 0) {
        const prompts = getL1ChunkingBatchPrompt(l1Inputs);
        await runBatch('1', prompts, model);
    }

    if (l2Inputs.length > 0) {
        const prompts = getL2ContextBatchPrompt(l2Inputs);
        await runBatch('2', prompts, model);
    }
}

// Meta-Eval Prompt Template (Used as footer for manual review)
const META_EVAL_TEMPLATE = `
---
# 💡 Manual Evaluation Instruction

Please copy the content above and send it to an LLM with the following prompt:

"""
# Role
你是一位精通 Prompt Engineering 的专家，擅长优化 LLM 的指令遵循能力和内容生成质量。

# Objective
评估用户提供的 System Prompt、User Prompt 以及 LLM 生成的 Result。
请分析 System Prompt 是否最优，生成的内容是否完全符合约束，并给出优化建议。

# Output Format (Markdown)
## 评分 (1-10分)
给出综合评分。

## 问题分析
指出生成内容中存在的问题（如未遵循的约束、逻辑漏洞、格式错误等）。

## 优化建议
针对 System Prompt 给出具体的修改建议（中文），如果是 Prompt 结构问题，请提供优化后的 Prompt 片段。
"""
`.trim();

async function runBatch(lvl: string, prompts: { system: string, user: string }, model: any) {
    console.log(`Processing Level ${lvl} Batch (${limit} items)...`);
    try {
        // Step 1: Generate Drill Content
        const result = await generateText({
            model,
            system: prompts.system,
            prompt: prompts.user,
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `Eval_L${lvl}_${timestamp}.md`;
        const filePath = path.join(outDir, filename);

        const content = `System Prompt:
${prompts.system}

User Prompt:
${prompts.user}

Result:
${result.text}

${META_EVAL_TEMPLATE}
`;

        await fs.writeFile(filePath, content);
        console.log(`Saved Report: ${filename}`);

    } catch (e) {
        console.error(`Failed Batch L${lvl}`, e);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
