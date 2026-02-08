/**
 * Prompt 调试工具 (Prompt Debugging Tool)
 * ==========================================
 * 
 * 目标: 使用真实数据库数据验证 System/User Prompt，并支持批量生成测试报告。
 * 
 * 核心功能:
 *   1. 真实数据: 连接生产 DB 获取完整上下文 (搭配词、词族等)。
 *   2. 智能选词: 根据生成器类型应用不同的选词策略，模拟生产环境。
 *   3. 数据校验: 确保输入数据有效，无效时使用 Pivot (兜底)。
 *   4. 批量验证: 默认随机抽取 N 个词进行测试，生成标准化的 output/*.txt 报告。
 *   5. LLM 执行: 支持 --run 参数实际调用 AI 生成结果。
 * 
 * 使用方式:
 *   1. 批量生成 Prompt 报告 (不调用 AI):
 *      npx tsx scripts/debug-prompt.ts -g l0-syntax
 * 
 *   2. 执行 AI 生成并查看结果:
 *      npx tsx scripts/debug-prompt.ts -g l2-smart --run -n 5
 *
 *   3. 指定 L2 Context Stage:
 *      npx tsx scripts/debug-prompt.ts -g l2-context-script --stage 3
 * 
 * 参数说明:
 *   -g, --gen     : 生成器类型 (l0-syntax | l0-phrase | l0-blitz | l2-smart | l2-context | l2-context-script | l2-nuance)
 *   -n, --number  : 批量大小 (默认 10)
 *   -r, --run     : 执行 AI 生成
 *   -s, --scenario: 指定场景 (仅 L2)
 *   --stage       : L2 Context Script 阶段 (1|2|3, 默认 1)
 */

import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import { db } from '@/lib/db';
import { AIService } from '@/lib/ai/core';
import { runEtlJob, EtlBatchResult } from '@/lib/etl/batch-runner';
import { getAIModel } from '@/lib/ai/client';
import {
    L0_SYNTAX_SYSTEM_PROMPT,
    getL0SyntaxUserPrompt,
    getL0SyntaxBatchPrompt,
    SyntaxGeneratorInput
} from '@/lib/generators/l0/syntax';
import {
    L0_PHRASE_SYSTEM_PROMPT,
    getL0PhraseBatchPrompt,
    PhraseGeneratorInput
} from '@/lib/generators/l0/phrase';
import {
    L0_BLITZ_SYSTEM_PROMPT,
    getL0BlitzBatchPrompt,
    BlitzGeneratorInput
} from '@/lib/generators/l0/blitz';
import {
    L2_SMART_CONTENT_SYSTEM_PROMPT,
    buildL2SentenceUserPrompt,
    SmartContentInput,
    L2SentencePayloadSchema
} from '@/lib/generators/l2/smart-content';
import {
    L2_CONTEXT_SYSTEM_PROMPT,
    getL2ContextBatchPrompt,
    ContextGeneratorInput
} from '@/lib/generators/l2/context';
import {
    getL2ContextBatchPrompt as getL2ContextScriptBatchPrompt,
    L2ContextInput as L2ContextScriptInput,
    ContextStage
} from '@/lib/generators/l2/context-script';
import {
    L2_NUANCE_SYSTEM_PROMPT,
    getL2NuanceBatchPrompt
} from '@/lib/generators/l2/nuance';
import {
    buildSyntaxInputSimple,
    buildPhraseInput,
    buildBlitzInputWithTraps
} from '@/lib/generators/input-builders';
import { VocabEntity, CollocationItem } from '@/types/vocab';
import { z } from 'zod';
import chalk from 'chalk';

// 加载环境变量
try { process.loadEnvFile(); } catch { }

const program = new Command();

// ==========================================
// 通用类型定义
// ==========================================

// VocabItem 接口现在使用 @/types/vocab 中的 VocabEntity
// 保留此别名以兼容现有代码，或直接替换
type VocabItem = VocabEntity;

interface DebugContext {
    adapter: GeneratorAdapter;
    runAI: boolean;
    scenario?: string;
    stage?: ContextStage;
    model: any;
    generatorKey: string;
}

// ==========================================
// 数据校验工具 (Fail-Safe)
// ==========================================

/**
 * 校验并提取 collocations 数组
 * @param raw 原始 collocations 数据 (可能是 null, undefined, object, array)
 * @returns 有效的 string[] 或空数组 (兜底)
 */
function extractCollocations(raw: any): string[] {
    if (!raw) return [];

    // 如果是数组
    if (Array.isArray(raw)) {
        return raw
            .map((item: any) => {
                // 支持 { text: "xxx" } 或 { word: "xxx" } 格式
                if (typeof item === 'string') return item;
                if (typeof item === 'object' && item !== null) {
                    return item.text || item.word || item.collocation || null;
                }
                return null;
            })
            .filter((s): s is string => typeof s === 'string' && s.length > 0);
    }

    return [];
}

/**
 * 校验数据是否满足生成器最低要求
 * @returns true 如果数据有效，false 如果应该跳过
 */
function validateVocabForGenerator(vocab: VocabItem, generatorKey: string): boolean {
    // 基础校验：必须有单词和释义
    if (!vocab.word || !vocab.definition_cn) {
        return false;
    }

    // 需要搭配词的生成器
    const needsCollocations = ['l0-phrase', 'l0-blitz', 'l2-context', 'l2-context-script'];
    if (needsCollocations.includes(generatorKey)) {
        const cols = extractCollocations(vocab.collocations);
        // 至少需要 1 个搭配词
        if (cols.length === 0) {
            return false;
        }
    }

    return true;
}

// ==========================================
// Generator Adapter 接口 & 实现
// ==========================================

interface GeneratorAdapter {
    name: string;
    /** 数据要求描述 (用于日志/报告) */
    dataRequirements?: string;
    buildInput: (vocab: VocabItem, extra?: any) => any;
    getPrompts: (input: any) => { system: string; user: string; schema?: z.ZodType<any> };
    getBatchPrompts?: (inputs: any[]) => { system: string; user: string; schema?: z.ZodType<any> };
}

const Adapters: Record<string, GeneratorAdapter> = {
    'l0-syntax': {
        name: 'L0 句法训练 / Syntax Rescue',
        dataRequirements: '需要: 释义, 搭配词 (可选)',
        buildInput: (vocab: VocabItem) => buildSyntaxInputSimple(vocab),
        getPrompts: (input: SyntaxGeneratorInput) => ({
            system: L0_SYNTAX_SYSTEM_PROMPT,
            user: getL0SyntaxUserPrompt(input)
        }),
        getBatchPrompts: (inputs: SyntaxGeneratorInput[]) => {
            return getL0SyntaxBatchPrompt(inputs);
        }
    },
    'l0-phrase': {
        name: 'L0 短语扩展 / Phrase Expansion',
        dataRequirements: '需要: 释义, 至少 1 个搭配词',
        buildInput: (vocab: VocabItem) => buildPhraseInput(vocab),
        getPrompts: (input: PhraseGeneratorInput) => ({
            system: L0_PHRASE_SYSTEM_PROMPT,
            user: JSON.stringify(input)
        }),
        getBatchPrompts: (inputs: PhraseGeneratorInput[]) => {
            return getL0PhraseBatchPrompt(inputs);
        }
    },
    'l0-blitz': {
        name: 'L0 闪电战 / Phrase Blitz',
        dataRequirements: '需要: 释义, 至少 1 个搭配词',
        buildInput: async (vocab: VocabItem) => await buildBlitzInputWithTraps(vocab),
        getPrompts: (input: BlitzGeneratorInput) => ({
            system: L0_BLITZ_SYSTEM_PROMPT,
            user: JSON.stringify(input)
        }),
        getBatchPrompts: (inputs: BlitzGeneratorInput[]) => {
            return getL0BlitzBatchPrompt(inputs);
        }
    },
    'l2-smart': {
        name: 'L2 智能内容 / Smart Content',
        dataRequirements: '需要: 释义',
        buildInput: (vocab: VocabItem, extra?: any) => {
            return {
                word: vocab.word,
                definition: vocab.definition_cn || '(无释义)',
                scenario: extra?.scenario
            } as SmartContentInput;
        },
        getPrompts: (input: SmartContentInput) => ({
            system: L2_SMART_CONTENT_SYSTEM_PROMPT,
            user: buildL2SentenceUserPrompt(input),
            schema: L2SentencePayloadSchema
        })
    },
    'l2-context': {
        name: 'L2 语境填空 / Context Cloze',
        dataRequirements: '需要: 释义, 搭配词',
        buildInput: (vocab: VocabItem) => {
            const contextKeywords = extractCollocations(vocab.collocations).slice(0, 3);

            return {
                targetWord: vocab.word,
                meaning: vocab.definition_cn || '',
                contextKeywords
            } as ContextGeneratorInput;
        },
        getPrompts: (input: ContextGeneratorInput) => ({
            system: L2_CONTEXT_SYSTEM_PROMPT,
            user: `GENERATE 1 CONTEXT DRILL.\n\nINPUT DATA:\n${JSON.stringify([input], null, 2)}`
        }),
        getBatchPrompts: (inputs: ContextGeneratorInput[]) => {
            return getL2ContextBatchPrompt(inputs);
        }
    },
    'l2-context-script': {
        name: 'L2 情境脚本 / Gap Fill (Part 5/6/7)',
        dataRequirements: '需要: 释义, 搭配词, 场景 (可选)',
        buildInput: (vocab: VocabItem, extra?: any) => {
            const contextWords = extractCollocations(vocab.collocations).slice(0, 3);

            return {
                targetWord: vocab.word,
                meaning: vocab.definition_cn || '',
                contextWords,
                scenario: extra?.scenario,
                stage: extra?.stage || 1
            } as L2ContextScriptInput;
        },
        getPrompts: (input: L2ContextScriptInput) => {
            const res = getL2ContextScriptBatchPrompt([input], input.stage);
            return { system: res.system, user: res.user };
        },
        getBatchPrompts: (inputs: L2ContextScriptInput[]) => {
            const stage = inputs[0]?.stage || 1;
            return getL2ContextScriptBatchPrompt(inputs, stage);
        }
    },
    'l2-nuance': {
        name: 'L2 商务辨析 / Nuance Discrimination',
        dataRequirements: '需要: 释义 (理想情况需要近义词对)',
        buildInput: (vocab: VocabItem) => {
            // Nuance 通常需要对比词，但在单独调试时只能用单词
            return {
                targetWord: vocab.word,
                meaning: vocab.definition_cn || '',
                word: vocab.word,
                definition_cn: vocab.definition_cn
            };
        },
        getPrompts: (input: any) => ({
            system: L2_NUANCE_SYSTEM_PROMPT,
            user: JSON.stringify([input])
        }),
        getBatchPrompts: (inputs: any[]) => {
            return getL2NuanceBatchPrompt(inputs);
        }
    }
};

// ==========================================
// 智能选词策略 (模拟 OMPS)
// ==========================================

/**
 * 根据生成器类型获取符合条件的词汇
 * 
 * 策略:
 *   - 通用: TOEIC 核心词, 有释义
 *   - L0 Phrase/Blitz: 必须有搭配词
 *   - L2 Context: 必须有搭配词
 */
const mapToVocabEntity = (raw: any): VocabEntity => ({
    vocabId: raw.id,
    word: raw.word,
    definition_cn: raw.definition_cn,
    word_family: raw.word_family as Record<string, string>,
    collocations: raw.collocations as CollocationItem[],
    partOfSpeech: raw.partOfSpeech
});

async function fetchBatchForGenerator(
    batchSize: number,
    generatorKey: string
): Promise<VocabItem[]> {
    // 基础查询条件 (所有生成器都需要)
    const baseWhere = {
        is_toeic_core: true,
        definition_cn: { not: null }  // 必须有释义
    };

    // 需要搭配词的生成器: 额外过滤
    const needsCollocations = ['l0-phrase', 'l0-blitz', 'l2-context', 'l2-context-script'];

    let whereCondition: any = baseWhere;

    if (needsCollocations.includes(generatorKey)) {
        // Prisma JSON 过滤: collocations 不为空数组
        // 注意: Postgres JSON 需要特殊处理
        whereCondition = {
            ...baseWhere,
            // 简化: 使用 NOT null 作为第一层过滤
            // 更精确的过滤在 fetchBatch 后用代码处理
            collocations: { not: undefined }
        };
    }

    // 获取符合条件的总数 (用于随机采样)
    const count = await db.vocab.count({ where: whereCondition });
    if (count === 0) {
        console.log(chalk.yellow(`⚠️ 没有找到符合 ${generatorKey} 要求的词汇`));
        return [];
    }

    // 随机偏移
    const skip = Math.max(0, Math.floor(Math.random() * Math.max(0, count - batchSize * 3)));

    // 获取候选词 (多取一些用于过滤)
    const rawCandidates = await db.vocab.findMany({
        where: whereCondition,
        take: batchSize * 3, // 多取，防止过滤后不足
        skip: skip,
        select: {
            id: true,
            word: true,
            definition_cn: true,
            collocations: true,
            word_family: true,
            partOfSpeech: true // [Fix] Add partOfSpeech
        }
    });

    // 转换为 VocabEntity
    const vocabEntities = rawCandidates.map(mapToVocabEntity);

    // 应用生成器特定的校验过滤
    const validItems = vocabEntities.filter(item =>
        validateVocabForGenerator(item, generatorKey)
    );

    // 取最终需要的数量
    const result = validItems.slice(0, batchSize);

    console.log(chalk.gray(
        `📊 选词统计: 候选 ${rawCandidates.length} → 有效 ${validItems.length} → 选取 ${result.length}`
    ));

    return result;
}

// ==========================================
// ETL 处理逻辑
// ==========================================

async function processBatch(
    items: VocabItem[],
    isDryRun: boolean,
    batchIndex: number,
    context?: DebugContext
): Promise<EtlBatchResult> {
    if (!context) throw new Error("Context missing");
    const { adapter, runAI, scenario, stage } = context;

    // 1. 构建输入 (带 Pivot 保护)
    const inputs = items.map(item => adapter.buildInput(item, { scenario, stage }));

    let systemPrompt = "";
    let userPrompt = "";
    let rawResult = "(AI 未执行)";

    // 2. 生成 Prompt (Batch vs 单条聚合)
    if (adapter.getBatchPrompts) {
        // 原生 Batch 支持 (如 L0)
        const prompts = adapter.getBatchPrompts(inputs);
        systemPrompt = prompts.system;
        userPrompt = prompts.user;

        if (runAI) {
            const res = await AIService.generateText({
                mode: 'smart',
                system: systemPrompt,
                prompt: userPrompt
            });
            rawResult = res.text;

            // 尝试格式化 JSON
            try {
                rawResult = JSON.stringify(JSON.parse(res.text), null, 2);
            } catch { }
        }
    } else {
        // 手动聚合 (如 L2 Smart)
        const firstPrompts = adapter.getPrompts(inputs[0]);
        systemPrompt = firstPrompts.system;

        // 拼接 User Prompts
        const userPromptsRaw = inputs.map((inp, i) => {
            const p = adapter.getPrompts(inp);
            return `--- 词条 ${i + 1}: ${items[i].word} ---\n${p.user}`;
        });
        userPrompt = userPromptsRaw.join('\n\n');

        if (runAI) {
            const results = [];
            for (const [i, input] of inputs.entries()) {
                const p = adapter.getPrompts(input);
                let resStr = "";
                try {
                    if (p.schema) {
                        const r = await AIService.generateObject({
                            mode: 'smart',
                            system: p.system,
                            prompt: p.user,
                            schema: p.schema
                        });
                        resStr = JSON.stringify(r.object, null, 2);
                    } else {
                        const r = await AIService.generateText({
                            mode: 'smart',
                            system: p.system,
                            prompt: p.user
                        });
                        resStr = r.text;
                    }
                } catch (e: any) {
                    resStr = `错误: ${e.message}`;
                }
                results.push(`--- 结果 ${i + 1}: ${items[i].word} ---\n${resStr}`);
            }
            rawResult = results.join('\n\n');
        } else {
            rawResult = "(AI 未执行 - 批量模式)";
        }
    }

    return {
        successCount: items.length,
        failedCount: 0,
        debugInfo: {
            systemPrompt: systemPrompt,
            userPrompt: userPrompt,
            rawResult: rawResult,
            batchId: `batch_${batchIndex}`
        }
    };
}

// ==========================================
// 主程序
// ==========================================

async function main() {
    program
        .name('debug-prompt')
        .description('使用真实 DB 数据调试 LLM Prompt (ETL 模式)')
        .option('-g, --gen <type>', '生成器类型')
        .option('-n, --number <count>', '处理数量', '10')
        .option('-r, --run', '执行 AI 生成', false)
        .option('-s, --scenario <scenario>', 'L2 场景')
        .option('--stage <stage>', 'L2 Context Script 阶段 (1|2|3)', '1');

    program.parse(process.argv);
    const options = program.opts();

    // 选择生成器
    let genKey = options.gen;
    if (!genKey) {
        genKey = await select({
            message: '选择生成器:',
            choices: Object.entries(Adapters).map(([key, adapter]) => ({
                name: `${adapter.name}`,
                value: key,
                description: adapter.dataRequirements
            }))
        });
    }

    const adapter = Adapters[genKey];
    if (!adapter) {
        console.error(chalk.red(`❌ 未知生成器: ${genKey}`));
        process.exit(1);
    }

    console.log(chalk.blue(`🚀 生成器: ${adapter.name}`));
    if (adapter.dataRequirements) {
        console.log(chalk.gray(`📋 数据要求: ${adapter.dataRequirements}`));
    }

    const { model, modelName } = getAIModel('etl');
    const stage = parseInt(options.stage) as ContextStage;

    // 运行 ETL
    await runEtlJob<VocabItem, DebugContext>({
        jobName: `debug-${genKey}`,
        tier: 'free',
        isDryRun: true,
        fetchBatch: async (size) => fetchBatchForGenerator(size, genKey),
        processBatch,
        context: {
            adapter,
            runAI: options.run,
            scenario: options.scenario,
            stage,
            model,
            generatorKey: genKey
        }
    });
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
