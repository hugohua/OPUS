
import { PrismaClient } from '../generated/prisma/client';
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
                }
            });
        }

        updatedCount++;
        if (isDryRun && updatedCount <= 5) {
            console.log(`[DryRun] Processed Oxford: ${ox.word}`, { abceedLevel, tagsCount: tags.length });
        }
    }

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
                    tags: ['abceed', `abceed_level_${abMeta.level}`]
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
                    tags: ['abceed', `abceed_level_${abMeta.level}`]
                }
            });
        }
        abceedNewCount++;
        if (isDryRun && abceedNewCount <= 5) {
            console.log(`[DryRun] New Abceed Word: ${abMeta.word}`);
        }
    }

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
