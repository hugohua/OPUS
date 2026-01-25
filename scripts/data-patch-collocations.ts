/**
 * Data Patch: Collocations Field (Backfill)
 * 
 * 功能：
 *   针对 collocations 为空数组 [] 或 null 的词汇，
 *   使用 AI 生成高质量的商务/常用搭配。
 * 
 * 使用方法：
 *   1. 单批次 (10 词):
 *      npx tsx scripts/data-patch-collocations.ts
 * 
 *   2. 持续模式 (全部修完):
 *      npx tsx scripts/data-patch-collocations.ts --continuous
 * 
 *   3. Dry Run (仅输出，不写库):
 *      npx tsx scripts/data-patch-collocations.ts --dry-run
 * 
 *   4. Sample Export (导出 JSON 样本):
 *      npx tsx scripts/data-patch-collocations.ts --sample=5 --output=output/sample.json
 */

try { process.loadEnvFile(); } catch (e) { }

import fs from 'fs/promises';
import { PrismaClient } from '../generated/prisma/client';
import { generateText } from 'ai';
import { getAIModel } from '../lib/ai/client';
import { z } from 'zod';
import { safeParse } from '../lib/ai/utils';

const prisma = new PrismaClient();

// --- Prompt Engineering ---
const PATCH_COLLOCATIONS_PROMPT = `
<system_role>
You are a Corpus Linguist specializing in TOEIC and Business English.
Your task is to generate high-quality, strictly structured JSON data for vocabulary learning.
</system_role>

<intelligence_logic>
1. Target: 
   Generate 2 collocations typical of TOEIC test materials.

2. Lexical Filter:
   - Skip function words such as articles, prepositions, conjunctions, and auxiliaries.
   - Only generate collocations for content words (nouns, verbs, adjectives, adverbs).

3. Domain Priority:
   a) Corporate, Office, Business Communication, HR, Finance, Logistics.
   b) Use General English only if business collocations are rare.

4. Collocation Style:
   - Formal and neutral tone.
   - Avoid slang, idioms, and spoken fillers.
   - Avoid metaphors and figurative language.
   - Do not generate emotional or subjective phrases.

5. Corporate Anchor Bias:
   - Prefer collocations containing corporate entities such as company, department, employee, customer, policy, contract, report, budget, schedule.

6. Structure Preference:
   - Verb + Noun (e.g., conduct a survey)
   - Adjective + Noun (e.g., annual report)
   - Noun + Noun (e.g., customer feedback)
   - Business prepositional phrases (e.g., in accordance with policy)
   - Avoid pure grammatical patterns (e.g., "be about to") without lexical content.

7. Infinitive Rule:
   - Allow "to + verb" if it forms a common business structure (e.g., plan to expand).
   - Avoid standalone infinitives without context.

8. Sense Control:
   - Use definition_cn to disambiguate meanings.
   - Do NOT mix different senses of the same word.

9. Sensitive Domain Filter:
   - Avoid political, ethical, religious, sexual, or medical sensitive topics unrelated to corporate context.

10. Translation:
   - Chinese translation must preserve business nuance and remain concise.

11. Output Ordering:
   - Sort collocations by typicality in TOEIC corporate context (most typical first).
</intelligence_logic>


<few_shot_examples>
- Input: {"word": "address", "definition_cn": "处理；演说"}
  -> Output: [
       {"text": "address the issue", "trans": "着手解决问题"},
       {"text": "deliver an address", "trans": "发表致辞"}
     ]

- Input: {"word": "minute", "definition_cn": "会议记录"}
  -> Output: [
       {"text": "take minutes", "trans": "做会议记录"},
       {"text": "circulate the minutes", "trans": "传阅会议纪要"}
     ]
</few_shot_examples>

<output_schema>
{
  "items": [
    {
      "word": "string",
      "collocations": [
        { "text": "string", "trans": "string" }
      ]
    }
  ]
}
</output_schema>

<formatting_constraints>
- Output RAW JSON ONLY. 
- No markdown, no prose.
- Start with "{" and end with "}".
</formatting_constraints>
`.trim();

// --- Zod Schema ---
const CollocationItemSchema = z.object({
    text: z.string(),
    trans: z.string(),
});

const PatchOutputSchema = z.object({
    items: z.array(z.object({
        word: z.string(),
        collocations: z.array(CollocationItemSchema)
    }))
});

// --- Configuration ---
let BATCH_SIZE = 30; // Default, can be overridden by --sample
const BATCH_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;

// --- Helper ---
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Fetch words needing patch ---
async function fetchNextBatch() {
    // 只处理 CORE 商务核心词
    const words = await prisma.$queryRaw<Array<{
        id: number;
        word: string;
        definition_cn: string | null;
        definitions: any;
    }>>`
        SELECT id, word, definition_cn, definitions
        FROM "Vocab"
        WHERE 
           (collocations IS NULL OR jsonb_array_length(collocations) = 0)
           AND is_toeic_core = true
           AND priority = 'CORE'
        ORDER BY word ASC
        LIMIT ${BATCH_SIZE}
    `;

    return words;
}

// --- Process Batch ---
async function processBatch(
    wordsToProcess: { id: number; word: string; definition_cn: string | null; definitions: any }[],
    isDryRun: boolean,
    outputFile?: string
): Promise<{ success: number; failed: number }> {
    const { model, modelName } = getAIModel('etl');

    const inputData = {
        items: wordsToProcess.map(w => {
            // Prioritize business_cn from definitions field if available
            let targetDef = w.definition_cn || '';

            // Check if definitions is a tailored object (not null, not array legacy)
            if (w.definitions && typeof w.definitions === 'object' && !Array.isArray(w.definitions)) {
                const defs = w.definitions as { business_cn?: string | null };
                if (defs.business_cn) {
                    targetDef = defs.business_cn; // Override with business sense
                }
            }

            return {
                word: w.word,
                definition_cn: targetDef
            };
        })
    };

    console.log(`[${modelName}] Processing ${wordsToProcess.length} words...`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const userPromptText = `
<user_input>
${JSON.stringify(inputData)}
</user_input>

<output_anchor>
{`;

            const { text } = await generateText({
                model,
                system: PATCH_COLLOCATIONS_PROMPT,
                prompt: userPromptText,
                temperature: 0.1,
            });

            // Parse response using safeParse utility
            let jsonText = text.trim();

            // Handle output anchor: if model continued from '{', prepend it back
            if (!jsonText.startsWith('{') && jsonText.includes('"items":')) {
                jsonText = '{' + jsonText;
            }

            // Use safeParse with Zod validation (includes JSON repair and truncation recovery)
            const ParsedResponseSchema = z.object({
                items: z.array(z.object({
                    word: z.string(),
                    collocations: z.array(CollocationItemSchema)
                }))
            });

            const rawData = safeParse(jsonText, ParsedResponseSchema, {
                systemPrompt: PATCH_COLLOCATIONS_PROMPT,
                userPrompt: userPromptText,
                model: modelName,
            });

            // Filter out items with empty collocations
            const validItems = rawData.items.filter(item => {
                if (item.collocations.length === 0) {
                    console.warn(`  ⚠️ Skipping item [${item.word}]: Empty collocations generated`);
                    return false;
                }
                return true;
            });

            if (validItems.length === 0) {
                throw new Error("No valid items found in batch");
            }

            const parsed = { success: true, data: { items: validItems } };

            if (outputFile) {
                console.log(`Writing result to ${outputFile}...`);
                await fs.writeFile(outputFile, JSON.stringify(parsed.data.items, null, 2), 'utf-8');
                return { success: parsed.data.items.length, failed: 0 };
            }

            if (isDryRun) {
                console.log('DRY-RUN: Would update:');
                parsed.data.items.forEach(item => {
                    console.log(`  [${item.word}]`);
                    item.collocations.forEach(c => console.log(`    - ${c.text} (${c.trans})`));
                });
                return { success: parsed.data.items.length, failed: 0 };
            }

            // Update DB
            let successCount = 0;
            for (const item of parsed.data.items) {
                const original = wordsToProcess.find(w => w.word === item.word);
                if (!original) continue;

                await prisma.vocab.update({
                    where: { id: original.id },
                    data: {
                        collocations: item.collocations as any
                    }
                });
                console.log(`  ✓ ${item.word} (${item.collocations.length} collocations)`);
                successCount++;
            }

            return { success: successCount, failed: wordsToProcess.length - successCount };

        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
            if (attempt < MAX_RETRIES) {
                await sleep(2000 * attempt);
            }
        }
    }

    return { success: 0, failed: wordsToProcess.length };
}

// --- Main ---
async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    const isContinuous = process.argv.includes('--continuous');

    // Parse --sample=N
    const sampleArg = process.argv.find(arg => arg.startsWith('--sample='));
    if (sampleArg) {
        const val = parseInt(sampleArg.split('=')[1]);
        if (!isNaN(val)) BATCH_SIZE = val;
    }

    // Parse --output=file.json
    const outputArg = process.argv.find(arg => arg.startsWith('--output='));
    const outputFile = outputArg ? outputArg.split('=')[1] : undefined;

    console.log('============================================================');
    console.log('  Data Patch: Collocations Field (Backfill)');
    console.log('============================================================');
    console.log({
        mode: outputFile ? 'EXPORT JSON' : (isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE BATCH'),
        batchSize: BATCH_SIZE
    });

    let totalSuccess = 0;
    let totalFailed = 0;
    let batchCount = 0;

    while (true) {
        const batch = await fetchNextBatch();

        if (batch.length === 0) {
            console.log('\n🎉 All done! No more words need patching.');
            break;
        }

        batchCount++;
        console.log(`\n--- Batch ${batchCount} (${batch.length} words) ---`);
        console.log(`Words: ${batch.map(w => w.word).join(', ')}`);

        // Force dry-run if outputting to file to strictly avoid DB writes
        const effectiveDryRun = isDryRun || !!outputFile;

        const result = await processBatch(batch, effectiveDryRun, outputFile);
        totalSuccess += result.success;
        totalFailed += result.failed;

        console.log(`Batch result: ${result.success} success, ${result.failed} failed`);

        // If exporting or not continuous, stop after one batch
        if (outputFile || !isContinuous) {
            break;
        }

        await sleep(BATCH_INTERVAL_MS);
    }

    console.log('\n============================================================');
    console.log(`Final: ${totalSuccess} patched, ${totalFailed} failed, ${batchCount} batches`);
    console.log('============================================================');
}

main()
    .catch(e => console.error('Fatal error:', e))
    .finally(() => prisma.$disconnect());
