/**
 * 修复/补齐词汇关系数据 (Relationships Fix Script)
 * 
 * 目标: 修复 Vocab 表中 missing relationship data:
 *   - word_family (词族)
 *   - confusing_words (易混词)
 *   - synonyms (近义词)
 * 
 * 策略: 使用 LLM (ETL Model) 针对商务语境生成。
 * 
 * 使用方式:
 *   1. 试运行 (Dry Run) & 输出到文件
 *      npx tsx scripts/data-fix-relationships.ts --dry-run --output debug_rel.jsonl
 * 
 *   2. 正式运行 (付费版/高速)
 *      npx tsx scripts/data-fix-relationships.ts --paid --continuous
 * 
 * 参数说明:
 *   --dry-run    : 演练模式，不修改数据库
 *   --paid       : 使用付费版配置 (高并发、低延迟限制)
 *   --continuous : 持续模式
 *   --output     : 指定输出文件路径 (JSONL)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { generateText } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import { runEtlJob } from '../lib/etl/batch-runner';
import { getAIModel } from '../lib/ai/client';
import { createLogger } from '../lib/logger';
import { safeParse } from '../lib/ai/utils';

// --- Init ---
try { process.loadEnvFile(); } catch (e) { /* ignore */ }
const log = createLogger('fix-relationships');
const prisma = new PrismaClient();

// --- Zod Schema ---
const WordFamilySchema = z.object({
    n: z.string().nullable().optional(),
    v: z.string().nullable().optional(),
    adj: z.string().nullable().optional(),
    adv: z.string().nullable().optional(),
});

const RelationshipItemSchema = z.object({
    id: z.number(),
    word: z.string(),
    word_family: WordFamilySchema,
    confusing_words: z.array(z.string()),
    synonyms: z.array(z.string()),
});

const OutputSchema = z.object({
    items: z.array(RelationshipItemSchema),
});

// --- Prompt ---
const RELATIONSHIP_BATCH_PROMPT = `
# ROLE
You are a Deterministic Data Transformation Engine used in an OFFLINE batch ETL pipeline.
Your sole responsibility is to compute structured vocabulary metadata for "Opus", a TOEIC Workplace Simulator.
Consistency, accuracy, and schema compliance are paramount.

You do NOT chat.
You do NOT explain.
You output RAW JSON only.

# TASK
Process the provided vocabulary list. For each word, generate **Lexical Relation Data** (\`word_family\`, \`confusing_words\`, \`synonyms\`) strictly adhering to the schema.

# INPUT DATA PROCESSING LOGIC (CRITICAL)
1. **ID Preservation**: You MUST return the EXACT same \`id\` for each item as provided in the input. Do not generate new IDs.
2. **Context**: Analyze the English \`word\` to determine its linguistic properties.

# FIELD-SPECIFIC INTELLIGENCE RULES

## 1. Word Family (\`word_family\`) - V-DIMENSION
- **Anti-Hallucination Rule**: If a form does not exist or is not commonly tested in TOEIC Part 5, return \`null\`. DO NOT invent words.
- Only include forms **aligned with the SAME sense** as the base word.
- Focus on TOEIC-relevant suffixes (-tion, -ive, -ly, -ment, -al).

## 2. Confusing Words (\`confusing_words\`) - V-DIMENSION
- Must be **visually or auditorily confusable in TOEIC contexts** (Malapropisms / Look-alikes).
- Must list 1–3 distractors.
- **Do NOT include**:
  - Antonyms
  - Rare or literary words
  - Semantically unrelated words

## 3. Synonyms (\`synonyms\`) - M-DIMENSION
- Must be formal business paraphrases suitable for TOEIC Part 7 (Paraphrasing questions).
- List 2–3 items.
- **Do NOT use casual words**.

# STRICT OUTPUT SCHEMA (JSON)
You must output a SINGLE JSON object containing an \`items\` array.

\`\`\`json
{
  "items": [
    {
      "id": 123,
      "word": "string (Input Word Identifier)",
      "word_family": {
        "n": "string | null",
        "v": "string | null",
        "adj": "string | null",
        "adv": "string | null"
      },
      "confusing_words": [ "string (e.g. affect/effect)" ],
      "synonyms": [ "string (Formal Business Only)" ]
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

// --- Status Helper ---
async function getPendingCount() {
    // Count records where ANY target field is missing/empty
    // Note: Prisma Query for empty arrays or null JSON

    // We try to estimate via standard Prisma count
    const count = await prisma.vocab.count({
        where: {
            OR: [
                { word_family: { equals: Prisma.DbNull } },
                { confusing_words: { equals: [] } },
                { synonyms: { equals: [] } }
            ]
        }
    });

    return { total: count };
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const isPaid = process.argv.includes('--paid');
    const isContinuous = process.argv.includes('--continuous');
    const isCheck = process.argv.includes('--check');
    const outputFile = getArgValue('--output');

    // Initialize Output File
    if (outputFile) {
        fs.writeFileSync(outputFile, '', 'utf-8');
        console.log(`[INFO] Output will be written to ${outputFile} (JSONL format)`);
    }

    // --- Check Mode ---
    if (isCheck) {
        console.log('Checking pending records...');
        const { total } = await getPendingCount();
        console.log('='.repeat(40));
        console.log(`Pending Relationships Fix: ${total}`);
        console.log('='.repeat(40));
        return;
    }

    // AI Model
    const { model, modelName } = getAIModel('etl');

    await runEtlJob<any>({
        jobName: 'Fix Relationships',
        tier: isPaid ? 'paid' : 'free',
        isDryRun,
        isContinuous,

        // 1. Fetch Logic
        fetchBatch: async (batchSize) => {
            // Find records missing ANY of the fields
            const items = await prisma.vocab.findMany({
                where: {
                    OR: [
                        { word_family: { equals: Prisma.DbNull } },
                        { confusing_words: { equals: [] } },
                        { synonyms: { equals: [] } }
                    ]
                },
                take: batchSize,
                select: { id: true, word: true, word_family: true, confusing_words: true, synonyms: true }
            });

            return items;
        },

        // 2. Process Logic
        processBatch: async (items, isDryRun, _) => {
            if (items.length === 0) return { successCount: 0, failedCount: 0 };

            let successCount = 0;
            let failedCount = 0;

            try {
                // Prepare Input
                const inputs = items.map(item => ({
                    id: item.id,
                    word: item.word
                    // We don't necessarily need to pass existing bad data, just the word is enough for generation.
                }));

                const userPrompt = JSON.stringify(inputs);

                const { text } = await generateText({
                    model,
                    system: RELATIONSHIP_BATCH_PROMPT,
                    prompt: userPrompt,
                    temperature: 0.1 // Deterministic
                });

                // Parse
                const result = safeParse(text, OutputSchema, {
                    model: modelName,
                    userPrompt: `Relationship Batch (${items.length} words)`
                });

                if (!result || !result.items) {
                    log.warn({ response: text }, 'Failed to parse batch response');
                    return { successCount: 0, failedCount: items.length };
                }

                // Update Loop
                for (const resItem of result.items) {
                    // ID Match
                    const original = items.find(i => i.id === resItem.id);
                    if (!original) {
                        log.warn({ aiId: resItem.id, word: resItem.word }, 'Mismatch: AI returned ID not in batch');
                        continue;
                    }

                    // Log to file
                    if (outputFile) {
                        fs.appendFileSync(outputFile, JSON.stringify({
                            id: original.id,
                            word: original.word,
                            new_data: {
                                family: resItem.word_family,
                                confusing: resItem.confusing_words,
                                synonyms: resItem.synonyms
                            }
                        }) + '\n', 'utf-8');
                    }

                    if (isDryRun) {
                        log.info({
                            word: original.word,
                            family: resItem.word_family
                        }, 'DRY-RUN: Update');
                        successCount++;
                    } else {
                        // DB Update
                        await prisma.vocab.update({
                            where: { id: original.id },
                            data: {
                                word_family: resItem.word_family as any, // Json
                                confusing_words: resItem.confusing_words,
                                synonyms: resItem.synonyms
                            }
                        });
                        log.info({ word: original.word }, 'Updated');
                        successCount++;
                    }
                }

                failedCount = items.length - successCount;

            } catch (e: any) {
                log.error({ error: e.message }, 'Batch Process Failed');
                failedCount = items.length;
                if (e.message.includes('429') || e.message.includes('503')) throw e;
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
