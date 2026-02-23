/**
 * Abceed JSON 数据库入库与合并脚本
 * 
 * 作用：将 `extract_abceed.ts` 生成的标准 Opus 词汇提取 JSON 文件，按照 upsert
 * (新建/合并) 的方式平滑写入到 PostgreSQL 的 `Vocab` 表中，处理同名词条的 source_meta 和 tags 合并。
 * 
 * 使用方法：
 * npx tsx scripts/seed-abceed-vocab.ts <input_json>
 * 
 * 参数说明：
 * - input_json: 提取转换后的 JSON 文件路径 (如: words/abceed_book2_extracted.json)
 * 
 * 示例：
 * npx tsx scripts/seed-abceed-vocab.ts words/abceed_book2_extracted.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ExtractedWord } from './extract_abceed';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: tsx seed-abceed-vocab.ts <input_json>');
    console.error('Example: tsx seed-abceed-vocab.ts words/abceed_book2_extracted.json');
    process.exit(1);
}

async function main() {
    const inputPath = path.resolve(process.cwd(), args[0]);
    console.log(`📡 读取数据源: ${inputPath}`);

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 找不到导出的 JSON 数据文件: ${inputPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(inputPath, 'utf8');
    const wordsToSeed: ExtractedWord[] = JSON.parse(rawData);

    console.log(`📦 准备处理 ${wordsToSeed.length} 个单词...`);

    let newCount = 0;
    let updatedCount = 0;

    for (const item of wordsToSeed) {
        const existingVocab = await prisma.vocab.findUnique({
            where: { word: item.word }
        });

        let mergedTags: string[] = item.tags;
        if (existingVocab && existingVocab.tags) {
            const existingTags = existingVocab.tags as string[];
            mergedTags = Array.from(new Set([...existingTags, ...item.tags]));
        }

        let mergedSourceMeta: any = item.source_meta;
        if (existingVocab && existingVocab.source_meta) {
            mergedSourceMeta = {
                ...(existingVocab.source_meta as object),
                ...(item.source_meta as object)
            };
        }

        // 如果已有搭配，追加新的搭配，确保 collocations 是数组
        let mergedCollocations = item.collocations;
        if (existingVocab && existingVocab.collocations) {
            const existingColls = (Array.isArray(existingVocab.collocations)
                ? existingVocab.collocations
                : [existingVocab.collocations]) as any[];
            // 简单去重 (基于 text)
            const existingTexts = new Set(existingColls.map((c: any) => c.text));
            const newColls = item.collocations.filter(c => !existingTexts.has(c.text));
            mergedCollocations = [...existingColls, ...newColls];
        }

        if (!existingVocab) {
            await prisma.vocab.create({
                data: {
                    word: item.word,
                    partOfSpeech: item.partOfSpeech,
                    abceed_level: item.abceed_level,
                    abceed_rank: item.abceed_rank,
                    definition_jp: item.definition_jp,
                    collocations: mergedCollocations as any,
                    source: item.source,
                    source_meta: mergedSourceMeta,
                    tags: mergedTags,
                }
            });
            newCount++;
        } else {
            await prisma.vocab.update({
                where: { word: item.word },
                data: {
                    tags: mergedTags,
                    source_meta: mergedSourceMeta,
                    abceed_level: existingVocab.abceed_level || item.abceed_level,
                    abceed_rank: existingVocab.abceed_rank || item.abceed_rank,
                    definition_jp: existingVocab.definition_jp || item.definition_jp,
                    collocations: mergedCollocations as any
                }
            });
            updatedCount++;
        }
    }

    console.log(`\n🎉 导入完成!`);
    console.log(` ✨ 新创造了 ${newCount} 个单词`);
    console.log(` 🔄 追加更新了 ${updatedCount} 个单词`);
}

main()
    .catch((e) => {
        console.error('导入时发生致命错误:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
