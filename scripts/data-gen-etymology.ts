/**
 * 词源数据生成脚本 (Etymology Generation Script)
 * ==========================================
 * 
 * 目标: 使用 AI 为 TOEIC 核心词汇生成结构化的词源数据 (记忆钩子)。
 * 
 * 策略: 
 *   - 优先复用高频词 (DERIVATIVE)
 *   - 其次使用词根拆解 (ROOTS)
 *   - 最后使用联想记忆 (ASSOCIATION)
 * 
 * 使用方式:
 *   1. 试运行 & 输出到文件 (Dry Run)
 *      npx tsx scripts/data-gen-etymology.ts --dry-run
 *      -> 生成 output/etymology-gen_dry_run_*.txt 用于 LLM 评估
 * 
 *   2. 正式运行 (Production)
 *      npx tsx scripts/data-gen-etymology.ts --paid --continuous
 * 
 * 参数说明:
 *   --dry-run    : 演练模式，读取随机样本，不写入数据库
 *   --paid       : 使用付费版配置 (高并发/高速)
 *   --continuous : 持续模式 (定期轮询 DB)
 * 
 * 环境变量:
 *   AI_MODEL_NAME   : 指定使用的模型 (默认: gpt-4o)
 *   OPENAI_API_KEY  : AI 服务商 Key
 *   ETL_BASE_URL    : 专用 ETL 线路 (可选, 优先于 OPENAI_BASE_URL)
 *   DATABASE_URL    : Postgres 连接串
 */

import { PrismaClient, EtymologyMode } from '@prisma/client';
import { ETYMOLOGY_SYSTEM_PROMPT } from '@/lib/generators/etymology';
import { createLogger } from '@/lib/logger';
import { runEtlJob, EtlBatchResult } from '@/lib/etl/batch-runner';
import { safeParse } from '@/lib/ai/utils';
import { getAIModel } from '@/lib/ai/client';
import { generateText } from 'ai';
import { z } from 'zod';

const log = createLogger('etl-etymology');
const prisma = new PrismaClient();

// --- Constants ---

const TARGET_CRITERIA = {
    etymology: { is: null },
    // is_toeic_core: true, // Expanded to ALL vocab
    // learningPriority: { gte: 60 }
};

// --- Context Types ---

interface EtlContext {
    model: any;
    modelName: string;
}

// --- Schema & Types ---

const EtymologyResponseSchema = z.object({
    word: z.string(),
    mode: z.enum(["ROOTS", "DERIVATIVE", "ASSOCIATION", "NONE"]),
    data: z.object({
        logic_cn: z.string().nullable(),
        roots: z.array(z.object({ part: z.string(), meaning_cn: z.string() })).optional(),
        related: z.array(z.string()).optional(),
        components: z.array(z.object({ part: z.string(), meaning_cn: z.string() })).optional(),
        origin_lang: z.string().optional(),
        origin_word: z.string().optional(),
    })
});

const BatchResponseSchema = z.object({
    results: z.array(EtymologyResponseSchema)
});

type EtymologyResponse = z.infer<typeof EtymologyResponseSchema>;

interface GenerateResult {
    results: EtymologyResponse[];
    debugInfo?: {
        systemPrompt: string;
        userPrompt: string;
        rawResponse: string;
    }
}

interface VocabItem {
    id: number;
    word: string;
}

// --- Core Logic ---

async function getTotalCount(isDryRun: boolean): Promise<number> {
    const count = await prisma.vocab.count({ where: TARGET_CRITERIA });
    return count;
}

async function fetchBatch(batchSize: number, isDryRun: boolean): Promise<VocabItem[]> {
    if (isDryRun) {
        // Randomize for Dry Run
        // 1. Get total count
        const count = await prisma.vocab.count({ where: TARGET_CRITERIA });
        if (count === 0) return [];

        // 2. Calculate random skip
        // If count < batchSize, skip 0. Else skip random.
        const maxSkip = Math.max(0, count - batchSize);
        const skip = Math.floor(Math.random() * maxSkip);

        log.info({ count, skip, batchSize }, "Dry Run Random Fetch");

        return prisma.vocab.findMany({
            where: TARGET_CRITERIA,
            take: batchSize,
            skip: skip,
            select: { id: true, word: true },
        });
    }

    // Normal Production Run (Priority Order)
    const items = await prisma.vocab.findMany({
        where: TARGET_CRITERIA,
        take: batchSize,
        select: { id: true, word: true },
    });

    log.info({
        itemsFound: items.length,
        batchSize,
        sampleWords: items.slice(0, 3).map(i => i.word)
    }, "Production Fetch");

    return items;
}

async function generateEtymology(words: string[], model: any, modelName: string): Promise<GenerateResult> {
    const userPrompt = `Words to analyze:\n${words.join('\n')}`;

    try {
        const { text } = await generateText({
            model,
            system: ETYMOLOGY_SYSTEM_PROMPT,
            prompt: userPrompt,
            temperature: 0.1
        });

        // Use safeParse for robust error handling and recovery
        const parsed = safeParse(text, BatchResponseSchema, {
            systemPrompt: ETYMOLOGY_SYSTEM_PROMPT,
            userPrompt: userPrompt,
            model: modelName
        });

        return {
            results: parsed.results || [],
            debugInfo: {
                systemPrompt: ETYMOLOGY_SYSTEM_PROMPT,
                userPrompt: userPrompt,
                rawResponse: text
            }
        };

    } catch (e) {
        log.error({ error: e, words }, "AI Generation Failed");
        return { results: [] };
    }
}

async function processBatchItem(
    items: VocabItem[],
    isDryRun: boolean,
    batchIndex: number,
    context?: EtlContext
): Promise<EtlBatchResult> {
    if (items.length === 0) return { successCount: 0, failedCount: 0 };

    // Get AI model from context (initialized once in main)
    const { model, modelName } = context!;

    const words = items.map(w => w.word);

    // Call AI
    const { results, debugInfo } = await generateEtymology(words, model, modelName);

    if (results.length === 0) {
        // If AI generation failed completely
        return { successCount: 0, failedCount: items.length };
    }

    // If Dry Run, return debug info for Runner to handle writing
    if (isDryRun) {
        return {
            successCount: items.length,
            failedCount: 0,
            debugInfo: debugInfo ? {
                systemPrompt: debugInfo.systemPrompt,
                userPrompt: debugInfo.userPrompt,
                rawResult: debugInfo.rawResponse,
                batchId: words[0] // Simple ID
            } : undefined
        };
    }

    // Write to DB
    let successCount = 0;
    let failedCount = 0;

    for (const res of results) {
        const vocab = items.find(w => w.word.toLowerCase() === res.word.toLowerCase());
        if (!vocab) {
            failedCount++; // Should technically not happen if AI is faithful
            continue;
        }

        try {
            await prisma.etymology.upsert({
                where: { vocabId: vocab.id },
                create: {
                    vocabId: vocab.id,
                    mode: res.mode as EtymologyMode,
                    memory_hook: res.data.logic_cn,
                    data: res.data as any,
                    source: modelName
                },
                update: {
                    mode: res.mode as EtymologyMode,
                    memory_hook: res.data.logic_cn,
                    data: res.data as any,
                    updatedAt: new Date()
                }
            });
            successCount++;
        } catch (e: any) {
            log.error({
                word: res.word,
                errorMessage: e.message,
                mode: res.mode,
                vocabId: vocab.id,
                ...(isDryRun ? { errorStack: e.stack } : {}) // 仅 dry-run 时输出完整堆栈
            }, "✗ Save Failed");
            failedCount++;
        }
    }

    // Adjust failed count if AI returned fewer items than requested
    failedCount += (items.length - results.length);

    return { successCount, failedCount };
}

// --- Main ---

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const isPaid = process.argv.includes('--paid');
    const isContinuous = process.argv.includes('--continuous');

    // 初始化 AI Model (配置一次，使用多次)
    const { model, modelName } = getAIModel('etl');

    await runEtlJob<VocabItem, EtlContext>({
        jobName: 'etymology-gen',
        tier: isPaid ? 'paid' : 'free',
        isDryRun,
        isContinuous,
        fetchBatch,
        getTotalCount,
        processBatch: processBatchItem,
        context: { model, modelName }
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
