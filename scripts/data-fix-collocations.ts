/**
 * 修复词汇搭配数据 (Collocations Fix Script)
 * 
 * 目标: 修复 Vocab 表中 collocations 字段缺失(null/空数组)或包含日文内容的数据。
 * 策略: 使用 LLM (ETL Model) 针对商务语境重新生成高质量的 collocations。
 * 
 * 依赖:
 *   - 环境变量: OPENAI_API_KEY, AI_MODEL_NAME (可选), DATABASE_URL
 *   - 基础设置: lib/etl/batch-runner.ts
 * 
 * 使用方式:
 * 
 *   1. 试运行 (Dry Run) - 仅打印生成的 JSON，不写入数据库
 *      npx tsx scripts/data-fix-collocations.ts --dry-run
 * 
 *   2. 正式运行 (免费版/低速) - 单次执行一批 (默认 Batch=10)，适合测试效果
 *      npx tsx scripts/data-fix-collocations.ts
 * 
 *   3. 正式运行 (免费版/低速) - 持续执行 (Continuous)，每批间隔 10分钟
 *      npx tsx scripts/data-fix-collocations.ts --continuous
 * 
 *   4. 正式运行 (付费版/高速) - 持续执行，高并发 (Batch=6, 并发=8)，适合大规模清洗
 *      npx tsx scripts/data-fix-collocations.ts --paid --continuous
 * 
 *   5. 调试模式 (输出到文件)
 *      npx tsx scripts/data-fix-collocations.ts --dry-run --output output/debug.jsonl
 * 
 * 参数说明:
 *   --dry-run    : 演练模式，不修改数据库
 *   --paid       : 使用付费版配置 (高并发、低延迟限制)
 *   --continuous : 持续模式，跑完一批后等待一段时间继续，直到处理完所有数据
 *   --output     : 指定输出文件路径 (JSONL 格式)，用于调试查看生成结果
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { generateText } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import { runEtlJob, EtlBatchResult } from '../lib/etl/batch-runner';
import { getAIModel } from '../lib/ai/client';
import { createLogger } from '../lib/logger';
import { safeParse } from '../lib/ai/utils';

// --- Init ---
try { process.loadEnvFile(); } catch (e) { /* ignore */ }
const log = createLogger('fix-collocations');
const prisma = new PrismaClient();

// --- Zod Schema ---
const CollocationItemSchema = z.object({
    text: z.string(),
    trans: z.string(),
    origin: z.enum(['abceed', 'ai']).optional().default('ai'),
    weight: z.number().optional().default(100),
});

const VocabItemSchema = z.object({
    id: z.number(),
    word: z.string(),
    collocations: z.array(CollocationItemSchema),
});

const OutputSchema = z.object({
    items: z.array(VocabItemSchema),
});

// --- Constants ---
const JAPANESE_REGEX = /[\u3040-\u30ff]/; // Hiragana/Katakana range

// --- Prompt ---
const COLLOCATION_BATCH_PROMPT = `
# ROLE
You are a Deterministic Data Transformation Engine used in an OFFLINE batch ETL pipeline.
Your sole responsibility is to compute structured vocabulary metadata for "Opus", a TOEIC Workplace Simulator.
Consistency, accuracy, and schema compliance are paramount.

You do NOT chat.
You do NOT explain.
You output RAW JSON only.

# TASK
Process the provided vocabulary list. For each word, generate **Collocation Data** strictly adhering to the schema.
Think like a strictly formal TOEIC Test Designer.

# INPUT DATA PROCESSING LOGIC (CRITICAL)
The input MAY contain Japanese fields (\`col_jp\`).
1. **Priority**: IF \`col_jp\` exists, translate THAT into Simplified Chinese. ELSE, translate from English input or generate new.
2. **Constraint**: Output MUST be Simplified Chinese. NO Japanese. NO English (except inside the \`text\` field).
3. **ID Preservation**: You MUST return the EXACT same \`id\` for each item as provided in the input. Do not generate new IDs.

# FIELD-SPECIFIC INTELLIGENCE RULES

## 1. Collocations (TARGET FIELD)
- **Quantity**: Output strictly **2-3** items per word.
- **Logic**:
  - IF collocation is explicitly provided in input (\`col_jp\` or \`col_en\`): Translate & Refine it. Set \`origin = "abceed"\`.
  - OTHERWISE (Input empty): Generate standard TOEIC Part 5/7 business collocations. Set \`origin = "ai"\`.
- **Content Style**:
  - Must be **chunks** (2-5 words), not full sentences.
  - Must be high-frequency business combinations (e.g., "meet the deadline", "negotiate a contract").

# STRICT OUTPUT SCHEMA (JSON)
You must output a SINGLE JSON object containing an \`items\` array.

\`\`\`json
{
  "items": [
    {
      "id": 123,
      "word": "string (Input Word Identifier)",
      "collocations": [
        {
          "text": "string (English Phrase)",
          "trans": "string (Chinese Translation)",
          "origin": "abceed" | "ai"
        }
      ]
    }
  ]
}
\`\`\`
`.trim();

// --- Helper for Arg Parsing ---
function getArgValue(argName: string): string | undefined {
    const index = process.argv.indexOf(argName);
    return (index !== -1 && index + 1 < process.argv.length) ? process.argv[index + 1] : undefined;
}

// --- Helpers ---
async function getPendingCount() {
    // 1. Count NULLs
    const nullCount = await prisma.vocab.count({
        where: {
            OR: [
                { collocations: { equals: Prisma.DbNull } },
                { collocations: { equals: [] } }
            ]
        }
    });

    // 2. Count Japanese (Estimate via Raw SQL)
    // Note: This matches the fetch logic
    const jpCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count
        FROM "Vocab"
        WHERE collocations::text ~ '[\\u3040-\\u30ff]'
    `;
    const jpCount = Number(jpCountResult[0]?.count || 0);

    return { nullCount, jpCount, total: nullCount + jpCount };
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const isPaid = process.argv.includes('--paid');
    const isContinuous = process.argv.includes('--continuous');
    const isCheck = process.argv.includes('--check');
    const outputFile = getArgValue('--output'); // e.g., --output debug_results.jsonl

    // Initialize Output File
    if (outputFile) {
        fs.writeFileSync(outputFile, '', 'utf-8'); // Clear/Create file
        console.log(`[INFO] Output will be written to ${outputFile} (JSONL format)`);
    }

    // --- Check Mode ---
    if (isCheck) {
        console.log('Checking pending records...');
        const { nullCount, jpCount, total } = await getPendingCount();
        console.log('='.repeat(40));
        console.log(`Pending Collocations Fix:`);
        console.log(`- Missing (Null/Empty): ${nullCount}`);
        console.log(`- Japanese Detected:    ${jpCount}`);
        console.log(`- Total Pending:        ${total}`);
        console.log('='.repeat(40));
        return;
    }

    // AI Model
    const { model, modelName } = getAIModel('etl');

    await runEtlJob<any>({
        jobName: 'Fix Collocations',
        tier: isPaid ? 'paid' : 'free',
        isDryRun,
        isContinuous,

        // 1. Fetch Logic
        fetchBatch: async (batchSize) => {
            // A. Find records with NULL collocations
            const nullCols = await prisma.vocab.findMany({
                where: {
                    OR: [
                        { collocations: { equals: Prisma.DbNull } },
                        { collocations: { equals: [] } }
                    ]
                },
                take: batchSize,
                select: { id: true, word: true, definition_cn: true, scenarios: true, collocations: true }
            });

            if (nullCols.length >= batchSize) return nullCols;

            // B. If we have space, find records with Japanese in collocations
            // Since Prisma filtering JSON arrays by regex is hard, we fetch candidates and filter in memory.
            // WARNING: This is expensive if table is huge. For now assuming we Iterate through IDs or just fetch a chunk to check.
            // Optimization: We might want to mark checked records or verify "updatedAt".
            // For simplicity in this script, we'll scan potentially "bad" candidates by text search if possible, or just limit scope.
            // Let's rely on the NULL check first. Validated "Japanese" checks are harder to query directly.
            // As a fallback for "Japanese" detection, we can just grab random records and filter in JS, 
            // but that's inefficient.
            // BETTER STRATEGY: 
            // Query records where collocations is NOT specific format? No.
            // Given the user requirement, let's prioritize NULLs. 
            // If NULLs are exhausted, we might need a separate mechanism or a specialized SQL raw query for speed.
            // For now, let's try to fetch a larger chunk of candidates that MIGHT have issues (e.g. source=abceed often has Japanese)
            // and filter them. 

            const remaining = batchSize - nullCols.length;
            if (remaining <= 0) return nullCols;

            // Fetch records that have collocations but might be Japanese
            // We'll simplisticly fetch recent ones or just accept we might not find them efficiently without Raw SQL.
            // Using a raw query for Japanese detection in JSONB is pg-specific but powerful.

            // PostgreSQL JSONB regex check (very rough):
            // cast collocations to text, then regex.
            const jpCandidates = await prisma.$queryRaw<any[]>`
                SELECT id, word, definition_cn, scenarios, collocations
                FROM "Vocab"
                WHERE collocations::text ~ '[\\u3040-\\u30ff]'
                LIMIT ${remaining};
             `;

            // Map raw results
            const mappedJp = jpCandidates.map(r => ({
                ...r,
                // Ensure fields match
            }));

            return [...nullCols, ...mappedJp];
        },

        // 2. Process Logic (Batch)
        processBatch: async (items, isDryRun, _) => {
            if (items.length === 0) return { successCount: 0, failedCount: 0 };

            let successCount = 0;
            let failedCount = 0;

            try {
                // Prepare Input for AI
                const inputs = items.map(item => ({
                    id: item.id,
                    word: item.word,
                    col_jp: Array.isArray(item.collocations) ? item.collocations : [], // Passing existing cols as context/source
                    scenarios: Array.isArray(item.scenarios) ? item.scenarios : []
                }));

                const userPrompt = JSON.stringify(inputs);

                const { text } = await generateText({
                    model,
                    system: COLLOCATION_BATCH_PROMPT,
                    prompt: userPrompt,
                    temperature: 0.1 // Deterministic
                });

                // Parse Batch Response
                const result = safeParse(text, OutputSchema, {
                    model: modelName,
                    userPrompt: 'Batch Processing'
                });

                if (!result || !result.items) {
                    log.warn({ response: text }, 'Failed to parse batch response');
                    // Fail all
                    return { successCount: 0, failedCount: items.length };
                }

                // Update Loop
                for (const resItem of result.items) {
                    // Robust matching (ID-based is deterministic)
                    const original = items.find(i => i.id === resItem.id);

                    if (!original) {
                        log.warn({ aiId: resItem.id, aiWord: resItem.word }, 'Mismatch: AI returned ID not in batch');
                        continue;
                    }

                    // --- Output to File (JSONL) ---
                    if (outputFile) {
                        const line = JSON.stringify({
                            id: original.id,
                            word: original.word,
                            ai_output: resItem.collocations,
                            processed_at: new Date().toISOString()
                        });
                        fs.appendFileSync(outputFile, line + '\n', 'utf-8');
                    }

                    if (isDryRun) {
                        log.info({ word: original.word, cols: resItem.collocations }, 'DRY-RUN: Update');
                        successCount++;
                    } else {
                        // DB Update
                        // Map `origin` (AI Schema) -> `source` (DB/Frontend Schema)
                        const finalCollocations = resItem.collocations.map(c => ({
                            text: c.text,
                            trans: c.trans,
                            weight: c.weight ?? 100,
                            source: c.origin // FIXED: Map origin -> source
                        }));

                        await prisma.vocab.update({
                            where: { id: original.id },
                            data: { collocations: finalCollocations as any }
                        });
                        log.info({ word: original.word }, 'Updated');
                        successCount++;
                    }
                }

                // Calculate failed
                failedCount = items.length - successCount;

            } catch (e: any) {
                log.error({ error: e.message }, 'Batch Process Failed');
                failedCount = items.length; // Assume all failed in this chunk

                // Bubble up rate limits
                if (e.message.includes('429') || e.message.includes('503')) {
                    throw e;
                }
            }

            return { successCount, failedCount };
        }
    });

    log.info('Done');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
