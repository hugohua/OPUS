/**
 * 补齐音标数据 (Phonetics Fix Script)
 * 
 * 目标: 补齐 Vocab 表中缺失的音标字段:
 *   - phoneticUk (英式音标 IPA)
 *   - phoneticUs (美式音标 IPA)
 * 
 * 策略: 使用 LLM (ETL Model) 生成标准 IPA 音标。
 * 
 * 使用方式:
 *   1. 试运行 & 输出到文件
 *      npx tsx scripts/data-fix-phonetics.ts --dry-run --output debug_phonetics.jsonl
 * 
 *   2. 正式运行 (付费版/高速)
 *      npx tsx scripts/data-fix-phonetics.ts --paid --continuous
 * 
 * 参数说明:
 *   --dry-run    : 演练模式，不修改数据库
 *   --paid       : 使用付费版配置
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
const log = createLogger('fix-phonetics');
const prisma = new PrismaClient();

// --- Zod Schema ---
const PhoneticItemSchema = z.object({
    id: z.number(),
    word: z.string(),
    phoneticUk: z.string(),
    phoneticUs: z.string(),
});

const OutputSchema = z.object({
    items: z.array(PhoneticItemSchema),
});

// --- Prompt ---
const PHONETIC_BATCH_PROMPT = `
# ROLE
You are a Deterministic Data Transformation Engine used in an OFFLINE batch ETL pipeline.
Your sole responsibility is to compute IPA phonetic transcriptions for "Opus", a TOEIC Workplace Simulator.
Consistency, accuracy, and schema compliance are paramount.

You do NOT chat.
You do NOT explain.
You output RAW JSON only.

# TASK
Process the provided vocabulary list. For each word, generate **IPA Phonetic Transcriptions** (UK and US) strictly adhering to the schema.

# INPUT DATA PROCESSING LOGIC (CRITICAL)
1. **ID Preservation**: You MUST return the EXACT same \`id\` for each item as provided in the input. Do not generate new IDs.
2. **Standard IPA**: Use standard International Phonetic Alphabet notation.
3. **UK vs US**: Distinguish clear pronunciation differences (e.g., /ˈskedʒuːl/ UK vs /ˈskedʒul/ US).

# FIELD-SPECIFIC INTELLIGENCE RULES

## 1. UK Phonetic (\`phoneticUk\`)
- Use British English pronunciation (Received Pronunciation / BBC English).
- Example: "schedule" → /ˈʃedjuːl/
- Must include primary stress mark (ˈ) for multi-syllable words.

## 2. US Phonetic (\`phoneticUs\`)
- Use American English pronunciation (General American).
- Example: "schedule" → /ˈskedʒuːl/
- Must include primary stress mark (ˈ) for multi-syllable words.

## 3. Quality Rules
- **No Slashes**: Return IPA symbols ONLY, without enclosing slashes (we add them in UI).
- **Accuracy**: If uncertain, use a standard dictionary reference (Cambridge/Oxford).
- **Common Words**: For basic words like "the", "a", transcribe their stressed form.

# STRICT OUTPUT SCHEMA (JSON)
You must output a SINGLE JSON object containing an \`items\` array.

\`\`\`json
{
  "items": [
    {
      "id": 123,
      "word": "string (Input Word Identifier)",
      "phoneticUk": "string (IPA without slashes, e.g. ˈskedʒuːl)",
      "phoneticUs": "string (IPA without slashes, e.g. ˈskedʒul)"
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
    const count = await prisma.vocab.count({
        where: {
            OR: [
                { phoneticUk: null },
                { phoneticUs: null }
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
        console.log(`Pending Phonetics Fix: ${total}`);
        console.log('='.repeat(40));
        return;
    }

    // AI Model
    const { model, modelName } = getAIModel('etl');

    await runEtlJob<any>({
        jobName: 'Fix Phonetics',
        tier: isPaid ? 'paid' : 'free',
        isDryRun,
        isContinuous,

        // 1. Fetch Logic
        fetchBatch: async (batchSize) => {
            const items = await prisma.vocab.findMany({
                where: {
                    OR: [
                        { phoneticUk: null },
                        { phoneticUs: null }
                    ]
                },
                take: batchSize,
                select: { id: true, word: true, phoneticUk: true, phoneticUs: true }
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
                }));

                const userPrompt = JSON.stringify(inputs);

                const { text } = await generateText({
                    model,
                    system: PHONETIC_BATCH_PROMPT,
                    prompt: userPrompt,
                    temperature: 0.1
                });

                // Parse
                const result = safeParse(text, OutputSchema, {
                    model: modelName,
                    userPrompt: `Phonetics Batch (${items.length} words)`
                });

                if (!result || !result.items) {
                    log.warn({ response: text }, 'Failed to parse batch response');
                    return { successCount: 0, failedCount: items.length };
                }

                // Update Loop
                for (const resItem of result.items) {
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
                            phoneticUk: resItem.phoneticUk,
                            phoneticUs: resItem.phoneticUs
                        }) + '\n', 'utf-8');
                    }

                    if (isDryRun) {
                        log.info({
                            word: original.word,
                            uk: resItem.phoneticUk,
                            us: resItem.phoneticUs
                        }, 'DRY-RUN: Update');
                        successCount++;
                    } else {
                        await prisma.vocab.update({
                            where: { id: original.id },
                            data: {
                                phoneticUk: resItem.phoneticUk,
                                phoneticUs: resItem.phoneticUs
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
