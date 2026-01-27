/**
 * Data Patch: Definitions Field Only (Lightweight ETL)
 * 
 * 功能：
 *   针对已有 definition_cn 但 definitions 为旧格式（数组）的词汇，
 *   使用轻量化 Prompt 只生成 { business_cn, general_cn } 结构。
 *   节省约 75% Token。
 * 
 * 使用方法：
 *   1. 单批次 (6 词):
 *      npx tsx scripts/data-patch-definitions.ts
 * 
 *   2. 持续模式 (全部修完):
 *      npx tsx scripts/data-patch-definitions.ts --continuous
 * 
 *   3. Dry Run (仅输出，不写库):
 *      npx tsx scripts/data-patch-definitions.ts --dry-run
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '@prisma/client';
import { generateText } from 'ai';
import { getAIModel } from '../lib/ai/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// --- Semantic Distillation Prompt (v3: XML Optimization) ---
const PATCH_DEFINITIONS_PROMPT = `
<system_role>
You are a Semantic Distillation Engine for TOEIC Vocabulary.
Your task is to generate the structured \`definitions\` object by analyzing the word's English meaning.
</system_role>

<input_schema>
{
  "items": [
    { "word": "string", "definition_cn": "string" }
  ]
}
</input_schema>

<intelligence_logic>
1. **Source of Truth**: 
   - Analyze the **English \`word\`** primarily. 
   - Use the provided \`definition_cn\` ONLY as a hint for the \`general_cn\` (common meaning).

2. **general_cn (Life Context)**:
   - The literal, common meaning used in daily life.
   - You MAY optimize the provided \`definition_cn\` if it's too long or archaic.
   - Max 8 chars.
   - Example: "minutes" -> "分钟".

3. **business_cn (TOEIC Context)**:
   - **Semantic Shift Rule**: Only populate this if the word has a **distinct, formal, or shifted meaning** in a business context compared to \`general_cn\`.
   - If the word means the same (e.g., "computer"), return \`null\`.
   - Max 8 chars.
   - Example: "minutes" -> "会议记录".
</intelligence_logic>

<few_shot_examples>
- Input: {"word": "address", "definition_cn": "地址"}
  -> Output Definitions: {"general_cn": "地址", "business_cn": "处理/致辞"} 
  *(Reason: Rule 3 allows finding "处理" even if input only says "地址")*

- Input: {"word": "stapler", "definition_cn": "订书机"}
  -> Output Definitions: {"general_cn": "订书机", "business_cn": null}

- Input: {"word": "perform", "definition_cn": "表演；执行"}
  -> Output Definitions: {"general_cn": "表演", "business_cn": "执行/履行"}
</few_shot_examples>

<output_schema>
{
  "items": [
    {
      "word": "string",
      "definitions": {
        "business_cn": "string | null",
        "general_cn": "string"
      }
    }
  ]
}
</output_schema>

<formatting_constraints>
- Output RAW JSON ONLY. No markdown, no explanation, no preamble.
- Start your response with "{" and end with "}".
- Do NOT include any text before or after the JSON object.
</formatting_constraints>
`.trim();

// --- Zod Schema for Output Validation ---
const PatchOutputSchema = z.object({
    items: z.array(z.object({
        word: z.string(),
        definitions: z.object({
            business_cn: z.string().nullable(),
            general_cn: z.string()
        })
    }))
});

// --- Configuration ---
const BATCH_SIZE = 30;  // Larger batch since output is smaller
const BATCH_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;

// --- Helper ---
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Fetch words needing patch ---
async function fetchNextBatch() {
    // 直接在数据库层筛选：definitions 是数组（旧格式）或缺少 general_cn
    const words = await prisma.$queryRaw<Array<{
        id: number;
        word: string;
        definition_cn: string | null;
        definitions: any;
    }>>`
        SELECT id, word, definition_cn, definitions
        FROM "Vocab"
        WHERE definition_cn IS NOT NULL
          AND (
            -- 旧格式：definitions 是数组
            jsonb_typeof(definitions) = 'array'
            -- 或者 definitions 为 null
            OR definitions IS NULL
            -- 或者缺少 general_cn 字段
            OR definitions->>'general_cn' IS NULL
          )
        ORDER BY word ASC
        LIMIT ${BATCH_SIZE}
    `;

    return words;
}

// --- Process Batch ---
async function processBatch(
    wordsToProcess: { id: number; word: string; definition_cn: string | null }[],
    isDryRun: boolean
): Promise<{ success: number; failed: number }> {
    const { model, modelName } = getAIModel('etl');

    const inputData = {
        items: wordsToProcess.map(w => ({
            word: w.word,
            definition_cn: w.definition_cn || ''
        }))
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
                system: PATCH_DEFINITIONS_PROMPT,
                prompt: userPromptText,
                temperature: 0.1,
            });

            // Parse response
            let jsonText = text.trim();

            // Handle output anchor: if model continued from '{', prepend it back
            if (!jsonText.startsWith('{') && jsonText.includes('"items":')) {
                jsonText = '{' + jsonText;
            }

            // 1. 尝试从 markdown 代码块中提取
            if (jsonText.includes('```')) {
                jsonText = jsonText.replace(/^[\s\S]*?```(?:json)?\n?/, '').replace(/\n?```[\s\S]*$/, '');
            }

            // 2. 尝试正则提取最外层 JSON 对象
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }

            let rawData: any;
            try {
                rawData = JSON.parse(jsonText);
            } catch (e) {
                console.error("JSON Parse failed on text:", jsonText.slice(0, 50) + "...");
                throw new Error("Invalid JSON format");
            }

            if (!rawData.items || !Array.isArray(rawData.items)) {
                throw new Error("Invalid JSON structure: missing 'items' array");
            }

            // 3. 逐条验证，舍弃非法数据
            const ItemSchema = z.object({
                word: z.string(),
                definitions: z.object({
                    business_cn: z.string().nullable(),
                    general_cn: z.string()
                })
            });

            const validItems: z.infer<typeof ItemSchema>[] = [];
            for (const item of rawData.items) {
                const result = ItemSchema.safeParse(item);
                if (result.success) {
                    validItems.push(result.data);
                } else {
                    console.warn(`  ⚠️ Skipping invalid item [${item.word}]:`, result.error.issues[0]?.message);
                }
            }

            if (validItems.length === 0) {
                throw new Error("No valid items found in batch");
            }

            // 使用有效数据覆盖 parsed.data
            const parsed = { success: true, data: { items: validItems } };

            if (isDryRun) {
                console.log('DRY-RUN: Would update:');
                parsed.data.items.forEach(item => {
                    console.log(`  [${item.word}] -> ${JSON.stringify(item.definitions)}`);
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
                        definitions: item.definitions as any
                    }
                });
                console.log(`  ✓ ${item.word}`);
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

    console.log('============================================================');
    console.log('  Data Patch: Definitions Field (Lightweight ETL)');
    console.log('============================================================');
    console.log({ mode: isDryRun ? 'DRY-RUN' : isContinuous ? 'CONTINUOUS' : 'SINGLE BATCH' });

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

        const result = await processBatch(batch, isDryRun);
        totalSuccess += result.success;
        totalFailed += result.failed;

        console.log(`Batch result: ${result.success} success, ${result.failed} failed`);

        if (!isContinuous) {
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
