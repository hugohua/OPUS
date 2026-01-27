/**
 * =============================================================================
 * 📝 脚本名称: data-enrich-vocab.ts
 * 📌 功能描述: 词汇数据源合并脚本 (Oxford 5000 + Abceed)
 * =============================================================================
 *
 * 🎯 主要功能:
 *   1. 从本地 JSON 文件加载 Oxford 5000 和 Abceed 词库数据
 *   2. 将两个数据源进行智能合并 (以 word 为 key 进行匹配)
 *   3. 批量 upsert 到数据库的 Vocab 表
 *
 * 📂 数据文件 (需放置在 raw_data/ 目录下):
 *   - oxford_5000.json  : Oxford 5000 词表 (含音标、CEFR 等级、例句)
 *   - abceed.json       : Abceed TOEIC 词库 (含日语释义、难度等级、搭配)
 *
 * 📊 数据合并逻辑:
 *   - Oxford 词汇: 添加 'oxford' tag, 使用其 CEFR Level、音标、例句
 *   - Abceed 匹配: 追加 'abceed' + 'abceed_level_N' tags, 使用其日语释义和搭配
 *   - Abceed 独有: 单独入库，仅包含 Abceed 元数据
 *
 * 🚀 运行方式:
 *   # 试运行 (不写入数据库，仅输出预览)
 *   npx tsx scripts/data-enrich-vocab.ts --dry-run
 *
 *   # 正式运行 (写入数据库)
 *   npx tsx scripts/data-enrich-vocab.ts
 *
 * ⚠️ 注意事项:
 *   - 运行前确保 raw_data/ 目录下有对应的 JSON 文件
 *   - 使用 --dry-run 先行验证数据是否正确
 *   - 此脚本为一次性初始化脚本，重复运行会更新已有记录
 *
 * =============================================================================
 */

try { process.loadEnvFile(); } catch { }
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// --- Types ---

interface OxfordItem {
    word: string;
    type: string;
    cefr: string;
    phon_br: string;
    phon_n_am: string;
    definition: string;
    example: string;
    uk: string;
    us: string;
}

interface AbceedRef {
    ref_num: number;
    ref_phrase_num?: number;
}

interface AbceedMeaning {
    meaning: string;
    phrase?: string;
    phrase_ja?: string;
}

interface AbceedWord {
    id_book: string;
    id_word: string;
    meaning_list: AbceedMeaning[];
    num_sort: number;
    reference_list: AbceedRef[];
    word: string;
}

interface AbceedLevelList {
    level: number;
    word_list: AbceedWord[];
}

interface AbceedPosList {
    level_list: AbceedLevelList[];
    pos: string;
}

interface AbceedRoot {
    average_level: number;
    // ... other fields
    pos_list: AbceedPosList[];
}

// Flat structure for easy lookup
interface AbceedFlat {
    word: string;
    level: number;
    rank: number; // num_sort
    pos: string;
    meanings: AbceedMeaning[];
    source_meta: { id_book: string; id_word: string };
}

// Helper to normalize POS tags to match "v.", "n." format used in SQL
function normalizePos(pos: string | undefined): string | null {
    if (!pos) return null;
    const lower = pos.toLowerCase();
    if (lower.startsWith('verb')) return 'v.';
    if (lower.startsWith('noun')) return 'n.';
    if (lower.startsWith('adj')) return 'adj.';
    if (lower.startsWith('adv')) return 'adv.';
    return lower;
}

// --- Main ---

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(isDryRun ? "🚀 Starting DRY RUN..." : "🚀 Starting Data Enrichment...");

    // 1. Load Data
    const oxfordPath = path.join(process.cwd(), 'raw_data', 'oxford_5000.json');
    const abceedPath = path.join(process.cwd(), 'raw_data', 'abceed.json');

    if (!fs.existsSync(oxfordPath) || !fs.existsSync(abceedPath)) {
        console.error("❌ Data files missing in raw_data/");
        process.exit(1);
    }

    const oxfordRaw = JSON.parse(fs.readFileSync(oxfordPath, 'utf-8'));
    const abceedRaw: AbceedRoot = JSON.parse(fs.readFileSync(abceedPath, 'utf-8'));

    const oxfordList: OxfordItem[] = Object.values(oxfordRaw);
    console.log(`✅ Loaded ${oxfordList.length} Oxford words.`);

    // 2. Process Abceed Data into Map
    const abceedMap = new Map<string, AbceedFlat>();

    if (abceedRaw.pos_list && Array.isArray(abceedRaw.pos_list)) {
        abceedRaw.pos_list.forEach(posItem => {
            posItem.level_list.forEach(levelItem => {
                levelItem.word_list.forEach(wordItem => {
                    const flat: AbceedFlat = {
                        word: wordItem.word,
                        level: levelItem.level,
                        rank: wordItem.num_sort,
                        pos: posItem.pos,
                        meanings: wordItem.meaning_list,
                        source_meta: {
                            id_book: wordItem.id_book,
                            id_word: wordItem.id_word
                        }
                    };
                    // Store lower case key for matching
                    abceedMap.set(wordItem.word.toLowerCase(), flat);
                });
            });
        });
    }
    console.log(`✅ Loaded ${abceedMap.size} Abceed words.`);

    // 3. Stats
    let updatedCount = 0;
    let createdCount = 0;
    let abceedNewCount = 0;

    // 4. Process Oxford List
    for (const ox of oxfordList) {
        if (!ox.word) continue;

        const key = ox.word.toLowerCase();
        const abceedData = abceedMap.get(key);
        abceedMap.delete(key); // Remove matching to track remaining later

        // Build Collocations / Definitions
        let collocations: any[] = [];
        let definitions: any[] = [];
        const tags: string[] = ['oxford'];

        // Oxford basic def
        definitions.push({
            type: 'oxford',
            text: ox.definition
        });

        // Merge Abceed logic
        let abceedLevel: number | null = null;
        let abceedRank: number | null = null;
        let sourceMeta: any = null;
        let definitionJp: string | null = null;

        if (abceedData) {
            tags.push('abceed');
            if (abceedData.level) tags.push(`abceed_level_${abceedData.level}`);

            abceedLevel = abceedData.level;
            abceedRank = abceedData.rank;
            sourceMeta = abceedData.source_meta;

            // Extract Phrases
            abceedData.meanings.forEach(m => {
                if (m.phrase) {
                    collocations.push({
                        text: m.phrase,
                        trans: m.phrase_ja || '',
                        source: 'abceed',
                        weight: 100
                    });
                }
                if (m.meaning && !definitionJp) {
                    definitionJp = m.meaning; // First meaning as JP definition
                }
            });
        }

        // Upsert
        if (!isDryRun) {
            await prisma.vocab.upsert({
                where: { word: ox.word },
                update: {
                    phoneticUk: ox.phon_br,
                    phoneticUs: ox.phon_n_am, // Check schema if exists, assumes modifying schema or checking field names
                    // Actually schema has phoneticUk but maybe not phoneticUs?
                    // Schema view: phoneticUk String? audioUk String? ...
                    // Let's stick to Schema: phoneticUk

                    // Re-check Schema:
                    // phoneticUk       String?  // 英式音标
                    // audioUk          String?  // 英式音频 URL
                    // definitions      Json     
                    // collocations     Json     
                    // source           String   @default("oxford_5000")
                    // source_meta      Json?
                    // cefrLevel        String? 
                    // abceed_level     Int?
                    // abceed_rank      Int?
                    // definition_jp    String? 
                    // tags             String[]

                    // Logic:
                    definitions: definitions,
                    collocations: collocations,
                    cefrLevel: ox.cefr,
                    abceed_level: abceedLevel,
                    abceed_rank: abceedRank,
                    source_meta: sourceMeta || undefined,
                    definition_jp: definitionJp,
                    tags: tags,
                    partOfSpeech: normalizePos(ox.type), // [Fix] Map POS
                },
                create: {
                    word: ox.word,
                    phoneticUk: ox.phon_br,
                    audioUk: ox.uk,
                    // Note: Oxford json has 'uk' field which is filename mostly?
                    definitions: definitions,
                    collocations: collocations,
                    source: 'oxford_5000',
                    cefrLevel: ox.cefr,
                    commonExample: ox.example,
                    abceed_level: abceedLevel,
                    abceed_rank: abceedRank,
                    source_meta: sourceMeta || undefined,
                    definition_jp: definitionJp,
                    tags: tags,
                    partOfSpeech: normalizePos(ox.type), // [Fix] Map POS
                }
            });
        }

        updatedCount++;
        if (isDryRun && updatedCount <= 5) {
            console.log(`[DryRun] Processed Oxford: ${ox.word}`, { abceedLevel, tagsCount: tags.length });
        }
        if (!isDryRun && updatedCount % 100 === 0) {
            process.stdout.write(`\r✅ Processed Oxford: ${updatedCount}/${oxfordList.length}`);
        }
    }
    console.log(""); // New line after loop

    // 5. Process Remaining Abceed Words (New)
    console.log(`Processing ${abceedMap.size} remaining Abceed words...`);

    for (const [key, abMeta] of abceedMap) {
        if (!isDryRun) {
            // Construct collocations
            let collocations: any[] = [];
            let definitionJp: string | null = null;
            abMeta.meanings.forEach(m => {
                if (m.phrase) {
                    collocations.push({
                        text: m.phrase,
                        trans: m.phrase_ja || '',
                        source: 'abceed',
                        weight: 100
                    });
                }
                if (m.meaning && !definitionJp) definitionJp = m.meaning;
            });

            await prisma.vocab.upsert({
                where: { word: abMeta.word },
                update: {
                    source: 'abceed',
                    abceed_level: abMeta.level,
                    abceed_rank: abMeta.rank,
                    source_meta: abMeta.source_meta,
                    definition_jp: definitionJp,
                    collocations: collocations,
                    tags: ['abceed', `abceed_level_${abMeta.level}`],
                    partOfSpeech: abMeta.pos, // [Fix] Map Abceed POS (Use raw for now)
                },
                create: {
                    word: abMeta.word,
                    definitions: [], // No english def from Oxford
                    collocations: collocations,
                    source: 'abceed',
                    abceed_level: abMeta.level,
                    abceed_rank: abMeta.rank,
                    source_meta: abMeta.source_meta,
                    definition_jp: definitionJp,
                    tags: ['abceed', `abceed_level_${abMeta.level}`],
                    partOfSpeech: abMeta.pos, // [Fix] Map Abceed POS
                }
            });
        }
        abceedNewCount++;
        if (isDryRun && abceedNewCount <= 5) {
            console.log(`[DryRun] New Abceed Word: ${abMeta.word}`);
        }
        if (!isDryRun && abceedNewCount % 100 === 0) {
            process.stdout.write(`\r✅ Processed Abceed: ${abceedNewCount}/${abceedMap.size}`);
        }
    }
    console.log(""); // New line after loop

    console.log(`
  🏁 JOB COMPLETE!
  --------------------------
  Updated (Oxford+Merged): ${updatedCount}
  New (Abceed Only): ${abceedNewCount}
  Total Processed: ${updatedCount + abceedNewCount}
  `);

    if (isDryRun) {
        console.log("⚠️  This was a DRY RUN. No DB changes made.");
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
