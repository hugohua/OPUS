/**
 * =============================================================================
 * 📝 脚本名称: data-backfill-vocab-fields.ts
 * 📌 功能描述: 补全旧数据缺失的新字段 (word_family, synonyms, confusing_words)
 * =============================================================================
 *
 * 🎯 主要功能:
 *   针对已有 definition_cn 但缺少 word_family 等新字段的词汇记录，
 *   重新调用 AI 进行增强，补全缺失字段。
 *
 * 📊 处理逻辑:
 *   - 查询条件: definition_cn != null AND word_family = null
 *   - 每批处理 10 个词汇
 *   - 使用与 data-etl-vocabulary-ai.ts 相同的 AI Prompt
 *
 * 🚀 运行方式:
 *   # 试运行 (不写入数据库)
 *   npx tsx scripts/data-backfill-vocab-fields.ts --dry-run
 *
 *   # 正式运行
 *   npx tsx scripts/data-backfill-vocab-fields.ts
 *
 * ⚠️ 注意事项:
 *   - 此脚本专门用于补全旧数据，不会处理 definition_cn = null 的记录
 *   - 运行前确保 .env 中 AI 相关配置正确
 *
 * =============================================================================
 */

try { process.loadEnvFile(); } catch (e) { }

import { Prisma, PrismaClient } from '@prisma/client';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import fs from 'fs/promises';
import path from 'path';
import { VOCABULARY_ENRICHMENT_PROMPT } from '@/lib/generators/etl/vocabulary';
import { VocabularyResultSchema } from '@/lib/validations/ai';
import { z } from 'zod';

// --- Configuration ---
const BATCH_SIZE = 10;
const MODEL_NAME = process.env.AI_MODEL_NAME || 'deepseek-v3.2';

// --- AI Setup ---
const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

const prisma = new PrismaClient();

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`=== 补全旧数据缺失字段 ===`);
    console.log(`模式: ${isDryRun ? 'DRY-RUN (试运行)' : 'LIVE (正式写入)'}`);
    console.log(`模型: ${MODEL_NAME}`);
    console.log('');

    // 1. 查询需要补全的记录
    // 条件: 有 definition_cn 但 word_family 为空
    const wordsToProcess = await prisma.vocab.findMany({
        where: {
            definition_cn: { not: null },
            word_family: { equals: Prisma.DbNull },
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
        console.log('✅ 所有记录已补全，无需处理。');
        return;
    }

    console.log(`📋 本批需补全: ${wordsToProcess.length} 条记录`);
    console.log(`   词汇: ${wordsToProcess.map((w: any) => w.word).join(', ')}`);
    console.log('');

    // 2. 构建 AI 输入
    const aiInput = wordsToProcess.map((w: any) => {
        // 解析 definitions：使用最新的对象格式 { business_cn, general_cn }
        let def_en = "";
        if (w.definitions && typeof w.definitions === 'object' && !Array.isArray(w.definitions)) {
            const defs = w.definitions as { business_cn?: string; general_cn?: string };
            def_en = defs.general_cn || defs.business_cn || "";
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
            col_jp: col_jp,
        };
    });

    // 3. 调用 AI
    console.log('🤖 调用 AI 处理中...');
    try {
        const { text } = await generateText({
            model: openai.chat(MODEL_NAME),
            system: VOCABULARY_ENRICHMENT_PROMPT,
            prompt: JSON.stringify(aiInput),
        });

        console.log('✅ AI 响应接收成功，解析中...');

        // 解析 JSON
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        let object: z.infer<typeof VocabularyResultSchema>;
        try {
            const parsed = JSON.parse(cleanText);
            object = VocabularyResultSchema.parse(parsed);
        } catch (e) {
            console.error('❌ JSON 解析/校验失败:', e);
            console.log('原始输出:', text);
            return;
        }

        if (isDryRun) {
            console.log('[DRY-RUN] 跳过数据库写入');
            const resultFile = path.join(process.cwd(), 'backfill_dry_run.json');
            await fs.writeFile(resultFile, JSON.stringify(object, null, 2));
            console.log(`[DRY-RUN] 结果已保存至 ${resultFile}`);
            return;
        }

        // 4. 更新数据库
        console.log('💾 写入数据库...');
        for (const item of object.items) {
            const original = wordsToProcess.find((w: any) => w.word === item.word);
            if (!original) continue;

            const finalCollocations = item.collocations.map(col => ({
                text: col.text,
                trans: col.trans,
                source: col.origin === 'abceed' ? 'abceed' : 'ai',
                weight: col.origin === 'abceed' ? 100 : 50,
            }));

            await prisma.vocab.update({
                where: { id: original.id },
                data: {
                    definition_cn: item.definition_cn,
                    definitions: item.definitions as any,
                    is_toeic_core: item.is_toeic_core,
                    scenarios: item.scenarios,
                    collocations: finalCollocations as any,
                    word_family: item.word_family as any,
                    confusing_words: item.confusing_words,
                    synonyms: item.synonyms,
                    priority: item.priority as any,
                },
            });
            console.log(`   ✓ ${item.word}`);
        }

        console.log('');
        console.log('🎉 本批处理完成！');
        console.log('   如需继续处理，请再次运行此脚本。');

    } catch (error) {
        console.error('❌ AI 调用失败:', error);
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
