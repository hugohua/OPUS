/**
 * Vocabulary Statistics & Health Check
 * 
 * 功能：
 *   统计词汇库的分布情况 (Level, Priority, Tags)。
 *   深度校验 AI 生成数据的完整性 (integrity check)。
 * 
 * 使用方法：
 *   npx tsx scripts/data-vocab-stats.ts
 */
try { process.loadEnvFile(); } catch (e) { }

import { Prisma, PrismaClient } from '../generated/prisma/client';
import { z } from 'zod';

// --- Zod Schemas for Validation (Inline for stability) ---

// 1. Definition Check
const DefinitionsSchema = z.object({
    business_cn: z.string().nullable().optional(),
    general_cn: z.string(),
});

// 2. Collocation Check
const CollocationItemSchema = z.object({
    text: z.string(),
    trans: z.string(),
    // origin: z.string().optional(), // relaxed check
});
const CollocationsSchema = z.array(CollocationItemSchema);

// 3. Word Family Check
// n, v, adj, adv must allow string or null, or absent
const WordFamilySchema = z.object({
    n: z.string().nullable().optional(),
    v: z.string().nullable().optional(),
    adj: z.string().nullable().optional(),
    adv: z.string().nullable().optional(),
});

// --- Main Logic ---

const prisma = new PrismaClient();

interface ErrorReport {
    word: string;
    errors: string[];
}

async function main() {
    console.log('正在读取数据库...');

    // Fetch all needed fields for validation
    // Warning: potentially large memory if millions of rows. 
    // Assuming <20k words, fetching into memory is fine (approx 20MB).
    const vocabs = await prisma.vocab.findMany({
        select: {
            id: true,
            word: true,
            definition_cn: true,
            definitions: true,
            collocations: true,
            word_family: true,
            scenarios: true,
            priority: true,
            is_toeic_core: true,
            partOfSpeech: true, // Keep this for stats
            confusing_words: true,
            synonyms: true,
            tags: true,
            // Corpus
            phoneticUk: true,
            phoneticUs: true,
            audioUk: true,
            commonExample: true,
            // Meta
            cefrLevel: true,
            abceed_level: true,
            abceed_rank: true,
            definition_jp: true,
            learningPriority: true,
            frequency_score: true,
        },
        orderBy: { id: 'asc' }
    });

    console.log(`Total Records: ${vocabs.length}`);
    console.log('-'.repeat(50));

    let stats = {
        total: vocabs.length,
        processed: 0,
        valid: 0,
        invalid: 0,
        unprocessed: 0,
        missing_fields: {
            definition_cn: 0,
            definitions_struct: 0,
            word_family_struct: 0,
            collocations_struct: 0,
            scenarios_missing_for_core: 0,
            priority_missing: 0,
            synonyms_missing: 0,
            confusing_words_missing: 0,
            tags_missing: 0,
            // Corpus
            phoneticUk_missing: 0,
            phoneticUs_missing: 0,
            audioUk_missing: 0,
            commonExample_missing: 0,
            // Meta
            cefrLevel_missing: 0,
            abceed_level_missing: 0,
            abceed_rank_missing: 0,
            definition_jp_missing: 0,
        },
        priority_dist: {
            // ...
            CORE: 0,
            SUPPORT: 0,
            NOISE: 0,
            NULL: 0,
        }
    };

    const errorReports: ErrorReport[] = [];

    for (const v of vocabs) {
        // ... previous checks ...
        // (existing logic)
        let isValid = true;
        const currentErrors: string[] = [];

        // 1. Check Unprocessed (Null definition_cn)
        if (!v.definition_cn) {
            stats.unprocessed++;
            // Unprocessed are not "Invalid" per se, they are just "Todo"
            // But if we want to check integrity of *processed* items, we distinguish them.
            // Let's treat completely unprocessed as "Pending".
            continue;
        }
        stats.processed++;

        // 2. Check Definitions Structure
        if (!v.definitions) {
            currentErrors.push('Missing definitions JSON');
            stats.missing_fields.definitions_struct++;
            isValid = false;
        } else {
            const parsed = DefinitionsSchema.safeParse(v.definitions);
            if (!parsed.success) {
                currentErrors.push('Invalid definitions format: Missing general_cn');
                stats.missing_fields.definitions_struct++;
                isValid = false;
            }
        }

        // 3. Check Word Family Structure
        if (!v.word_family) {
            // Note: Some words might honestly not have families, but our prompt tries to output empty obj.
            // If it's strict, we expect an object.
            // Let's assume if it is "Processed" (has definition_cn), it SHOULD have word_family.
            currentErrors.push('Missing word_family');
            stats.missing_fields.word_family_struct++;
            isValid = false;
        } else {
            const parsed = WordFamilySchema.safeParse(v.word_family);
            if (!parsed.success) {
                currentErrors.push('Invalid word_family format');
                stats.missing_fields.word_family_struct++;
                isValid = false;
            }
        }

        // 4. Check Collocations Structure
        if (!v.collocations) {
            // Can be empty array, but shouldn't be null if processed
            currentErrors.push('Missing collocations field');
            stats.missing_fields.collocations_struct++;
            isValid = false;
        } else {
            if (!Array.isArray(v.collocations)) {
                currentErrors.push('Collocations is not array');
                stats.missing_fields.collocations_struct++;
                isValid = false;
            } else if (v.collocations.length === 0) {
                // [NEW] Treat empty array as missing data
                currentErrors.push('Collocations array is empty');
                stats.missing_fields.collocations_struct++;
                isValid = false;
            } else {
                // Check internal items
                const parsed = CollocationsSchema.safeParse(v.collocations);
                if (!parsed.success) {
                    currentErrors.push('Invalid collocations content');
                    stats.missing_fields.collocations_struct++;
                    isValid = false;
                }
            }
        }

        // 5. Check Priority
        if (!v.priority) {
            stats.priority_dist.NULL++;
            stats.missing_fields.priority_missing++;
            currentErrors.push('Missing priority');
            isValid = false;
        } else {
            // @ts-ignore
            stats.priority_dist[v.priority] = (stats.priority_dist[v.priority] || 0) + 1;
        }

        // 6. Check Scenarios for CORE
        if (v.priority === 'CORE' && (!v.scenarios || v.scenarios.length === 0)) {
            // Relaxed check: maybe some core words are bare? 
            // But per design, CORE implies Business scenarios.
            currentErrors.push('CORE word missing scenarios');
            stats.missing_fields.scenarios_missing_for_core++;
            isValid = false;
        }

        // 7. Check Synonyms
        if (!v.synonyms || (v.priority === 'CORE' && v.synonyms.length === 0)) {
            // Only really enforced for CORE
            if (v.priority === 'CORE') {
                currentErrors.push('CORE word missing synonyms');
                stats.missing_fields.synonyms_missing++;
                isValid = false;
            }
        }

        // 8. Check Confusing Words
        // Not strictly required for validity, but good to know stats
        if (!v.confusing_words || v.confusing_words.length === 0) {
            stats.missing_fields.confusing_words_missing++;
        }

        // 9. Check Tags
        if (!v.tags || v.tags.length === 0) {
            stats.missing_fields.tags_missing++;
        }

        // 10. Check Corpus Fields (Stats only)
        if (!v.phoneticUk) stats.missing_fields.phoneticUk_missing++;
        if (!v.phoneticUs) stats.missing_fields.phoneticUs_missing++;
        if (!v.audioUk) stats.missing_fields.audioUk_missing++;
        if (!v.commonExample) stats.missing_fields.commonExample_missing++;

        // 11. Check Meta fields (Stats only)
        if (!v.cefrLevel) stats.missing_fields.cefrLevel_missing++;
        if (!v.abceed_level) stats.missing_fields.abceed_level_missing++;
        if (!v.abceed_rank) stats.missing_fields.abceed_rank_missing++;
        if (!v.definition_jp) stats.missing_fields.definition_jp_missing++;


        if (isValid) {
            stats.valid++;
        } else {
            stats.invalid++;
            if (errorReports.length < 50) { // Limit samples
                errorReports.push({ word: v.word, errors: currentErrors });
            }
        }
    }

    // --- Report Output ---

    console.log('=== 总体统计 ===');
    console.log(`总数 (Total):         ${stats.total}`);
    console.log(`待处理 (Pending):     ${stats.unprocessed}`);
    console.log(`已处理 (Processed):   ${stats.processed}`);
    console.log(`  ✅ 校验通过:        ${stats.valid}`);
    console.log(`  ❌ 校验失败:        ${stats.invalid}`);
    console.log('');

    console.log('=== 字段完整性问题 (Invalid Only) ===');
    console.log(`* 结构化释义错误 (Definitions):    ${stats.missing_fields.definitions_struct}`);
    console.log(`* 词族缺失/格式错 (Word Family):   ${stats.missing_fields.word_family_struct}`);
    console.log(`* 搭配缺失/格式错 (Collocations):  ${stats.missing_fields.collocations_struct}`);
    console.log(`* 优先级缺失 (Priority Missing):   ${stats.missing_fields.priority_missing}`);
    console.log(`* 核心词缺失场景 (CORE no Scenario): ${stats.missing_fields.scenarios_missing_for_core}`);
    console.log(`* 核心词缺失同义词 (CORE no Synonyms): ${stats.missing_fields.synonyms_missing}`);
    console.log('');

    console.log('=== 字段填充率统计 (Stats Only - Not Errors) ===');
    console.log(`* 易混淆词为空 (Empty Confusing):  ${stats.missing_fields.confusing_words_missing}`);
    console.log(`* 标签为空 (Empty Tags):           ${stats.missing_fields.tags_missing}`);
    console.log(`-- 基础语料 --`);
    console.log(`* 音标缺失 (Phonetic UK):          ${stats.missing_fields.phoneticUk_missing}`);
    console.log(`* 音频缺失 (Audio UK):             ${stats.missing_fields.audioUk_missing}`);
    console.log(`* 例句缺失 (Common Example):       ${stats.missing_fields.commonExample_missing}`);
    console.log(`-- 元数据 --`);
    console.log(`* CEFR 分级缺失:                   ${stats.missing_fields.cefrLevel_missing}`);
    console.log(`* Abceed Level 缺失:               ${stats.missing_fields.abceed_level_missing}`);
    console.log(`* 日文释义缺失 (Def JP):           ${stats.missing_fields.definition_jp_missing}`);
    console.log('');

    console.log('=== 优先级分布 (Priority) ===');
    console.log(`CORE:    ${stats.priority_dist.CORE}`);
    console.log(`SUPPORT: ${stats.priority_dist.SUPPORT}`);
    console.log(`NOISE:   ${stats.priority_dist.NOISE}`);
    console.log(`NULL:    ${stats.priority_dist.NULL}`);
    console.log('');

    // if (errorReports.length > 0) {
    //     console.log('=== 错误样本 (First 50) ===');
    //     errorReports.forEach(r => {
    //         console.log(`[${r.word.padEnd(15)}] ${r.errors.join(', ')}`);
    //     });
    // }

    // Part of speech stats (Original logic)
    // const posStats = await prisma.vocab.groupBy({
    //     by: ['partOfSpeech'],
    //     _count: { _all: true }
    // });
    // console.log('\n=== Part of Speech 分布 ===');
    // posStats
    //     .sort((a, b) => b._count._all - a._count._all)
    //     .slice(0, 10)
    //     .forEach(stat => {
    //         const pos = stat.partOfSpeech === null ? 'NULL' : stat.partOfSpeech;
    //         console.log(`${pos.padEnd(10)}: ${stat._count._all}`);
    //     });

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
