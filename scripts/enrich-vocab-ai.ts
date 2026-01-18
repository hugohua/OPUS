
import { PrismaClient } from '../generated/prisma/client';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

// --- Configuration ---
const BATCH_SIZE = 10;
const MODEL_NAME = process.env.AI_MODEL_NAME || 'deepseek-v3.2';

// --- AI Setup ---
const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

const prisma = new PrismaClient();

// --- Schemas ---
const CollocationSchema = z.object({
    text: z.string(),
    trans: z.string(),
    origin: z.enum(['abceed', 'ai']),
});

const DefinitionsSchema = z.object({
    business_cn: z.string().nullable().describe('Specific business meaning'),
    general_cn: z.string().describe('General meaning'),
});

const ResultItemSchema = z.object({
    word: z.string(),
    definition_cn: z.string().describe('Concise Chinese definition for UI Card'),
    definitions: DefinitionsSchema,
    is_toeic_core: z.boolean(),
    scenarios: z.array(z.string()),
    collocations: z.array(CollocationSchema),
});

const ResultSchema = z.array(ResultItemSchema);

// --- Prompt ---
const SYSTEM_PROMPT = `
# Role
You are a Senior TOEIC Business English Instructor and Expert Translator (Japanese/English to Simplified Chinese).
Your goal is to prepare structured vocabulary data for a professional "Pro Max" level learning app.

# Task
I will provide a JSON list of words. Some words contain raw Japanese data, while others only have basic English definitions.

For each word, you must:
1. **Translate & Refine**: 
   - If Japanese data exists, translate it to professional Simplified Chinese (suitable for business contexts).
   - If only English data exists, translate the English definition to Chinese.
2. **Analyze Context**: Determine if the word is core to International Business/TOEIC.
3. **Structure**: Output a strict JSON object matches the database schema.

# Output Schema
You must output a valid JSON array of objects. Do not wrap in markdown code blocks if possible, but if you do, I will clean it.
Structure per word:
{
  "word": "string",
  "definition_cn": "concise string (max 10 chars)",
  "definitions": { "business_cn": "string or null", "general_cn": "string" },
  "is_toeic_core": boolean,
  "scenarios": ["string", ...],
  "collocations": [{ "text": "string", "trans": "string", "origin": "abceed" or "ai" }]
}

# Constraint
- Use Simplified Chinese.
- Translate Japanese brackets like 家族[ペット] to 家人[宠物].
`.trim();

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`Starting enrichment... Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'}`);

    // 1. Fetch Words (Find words that haven't been enriched yet)
    // Logic: definition_cn is null
    const wordsToProcess = await prisma.vocab.findMany({
        where: {
            definition_cn: null,
        },
        take: BATCH_SIZE,
        select: {
            id: true,
            word: true,
            definitions: true,
            definition_jp: true,
            collocations: true,
        },
    });

    if (wordsToProcess.length === 0) {
        console.log('No words need processing.');
        return;
    }

    console.log(`Fetched ${wordsToProcess.length} words.`);

    // 2. Construct Input for AI
    const aiInput = wordsToProcess.map((w: any) => {
        // Parse existing unstructured data if necessary

        // Def En: Try to extract from current definitions if it has english
        let def_en = "";
        if (w.definitions && Array.isArray(w.definitions)) {
            const defs = w.definitions as any[];
            const enDef = defs.find(d => d.type === 'general' || d.type === 'english');
            if (enDef) def_en = enDef.text;
        }

        // Col JP: Extract abceed collocations
        let col_jp: any[] = [];
        if (w.collocations && Array.isArray(w.collocations)) {
            col_jp = (w.collocations as any[]).filter(c => c.source === 'abceed');
        }

        return {
            word: w.word,
            def_en: def_en,
            def_jp: w.definition_jp,
            col_jp: col_jp
        };
    });

    // 3. Call AI
    console.log('Sending to AI (generateText)...');
    try {
        const { text } = await generateText({
            model: openai.chat(MODEL_NAME),
            system: SYSTEM_PROMPT,
            prompt: JSON.stringify(aiInput),
        });

        console.log('AI response received.');

        // Clean and parse JSON
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        let object: z.infer<typeof ResultSchema>;
        try {
            const parsed = JSON.parse(cleanText);
            object = ResultSchema.parse(parsed);
        } catch (e) {
            console.error('JSON Parse/Validation Error:', e);
            console.log('Raw output:', text);
            return;
        }

        if (isDryRun) {
            console.log('[DRY-RUN] Skipping DB update.');
            const resultFile = path.join(process.cwd(), 'vocab_enrich_dry_run.json');
            await fs.writeFile(resultFile, JSON.stringify(object, null, 2));
            console.log(`[DRY-RUN] Results written to ${resultFile}`);
            return;
        }

        // 4. Update Database
        console.log('Updating database...');
        for (const item of object) {
            const original = wordsToProcess.find((w: any) => w.word === item.word);
            if (!original) continue;

            const finalCollocations = item.collocations.map(col => ({
                text: col.text,
                trans: col.trans,
                source: col.origin === 'abceed' ? 'abceed' : 'ai',
                weight: col.origin === 'abceed' ? 100 : 50
            }));

            await prisma.vocab.update({
                where: { id: original.id },
                data: {
                    definition_cn: item.definition_cn,
                    definitions: item.definitions as any,
                    is_toeic_core: item.is_toeic_core,
                    scenarios: item.scenarios,
                    collocations: finalCollocations as any,
                },
            });
            console.log(`Updated: ${item.word}`);
        }

        console.log('Done.');

    } catch (error) {
        console.error("AI Error:", error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
