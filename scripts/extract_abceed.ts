/**
 * Abceed JSON 提取与转换脚本
 * 
 * 作用：将 Abceed 导出的原始 JSON 数据转换为 Opus 系统通用的题库和词汇格式。
 * 
 * 使用方法：
 * npx tsx scripts/extract_abceed.ts <input_json> <output_json> <book_slug>
 * 
 * 参数说明：
 * - input_json: Abceed 导出的原始 JSON 文件路径 (如: words/abceed_book2.json)
 * - output_json: 转换后的 JSON 输出路径 (如: words/abceed_book2_extracted.json)
 * - book_slug: 书籍标识符，将用作来源(source)及标签(book:slug) (如: tokyu_kuro_phrase)
 * 
 * 示例：
 * npx tsx scripts/extract_abceed.ts words/abceed_book2.json words/abceed_book2_extracted.json tokyu_kuro_phrase
 */

import * as fs from 'fs';
import * as path from 'path';

interface Meaning {
    meaning: string;
    phrase: string;
    phrase_ja: string;
}

interface AbceedWord {
    id_book: string;
    id_word: string;
    word: string;
    num_sort: number;
    meaning_list: Meaning[];
}

interface AbceedLevel {
    level: number;
    word_list: AbceedWord[];
}

interface AbceedPos {
    pos: string;
    level_list: AbceedLevel[];
}

interface AbceedData {
    pos_list: AbceedPos[];
}

export interface Collocation {
    text: string;
    trans: string;
    source: string;
    weight: number;
}

export interface ExtractedWord {
    word: string;
    partOfSpeech: string;
    abceed_level: number;
    abceed_rank: number;
    tags: string[];
    source: string;
    source_meta: {
        [book_slug: string]: {
            level: number;
            rank: number;
            id_book: string;
            id_word: string;
        }
    };
    collocations: Collocation[];
    definition_jp: string;
}

const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('Usage: tsx extract_abceed.ts <input_json> <output_json> <book_slug>');
    console.error('Example: tsx extract_abceed.ts words/abceed_book2.json words/abceed_book2_extracted.json tokyu_kuro_phrase');
    process.exit(1);
}

const inputPath = path.resolve(process.cwd(), args[0]);
const outputPath = path.resolve(process.cwd(), args[1]);
const BOOK_SLUG = args[2];
const BOOK_TAG = `book:${BOOK_SLUG}`;

console.log(`Reading data from: ${inputPath}`);
console.log(`Target Slug: ${BOOK_SLUG}`);

if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
}

const rawData = fs.readFileSync(inputPath, 'utf8');
const data: AbceedData = JSON.parse(rawData);
const extracted: ExtractedWord[] = [];

data.pos_list.forEach((posGroup) => {
    posGroup.level_list.forEach((lvlGroup) => {
        lvlGroup.word_list.forEach((w) => {
            const collocations: Collocation[] = w.meaning_list
                .filter((m) => m.phrase)
                .map((m) => ({
                    text: m.phrase,
                    trans: m.phrase_ja,
                    source: BOOK_SLUG,
                    weight: 100,
                }));

            const definition_jp = w.meaning_list.map((m) => m.meaning).join('; ');

            extracted.push({
                word: w.word,
                partOfSpeech: posGroup.pos,
                abceed_level: lvlGroup.level,
                abceed_rank: w.num_sort,
                tags: [BOOK_TAG, "toeic"],
                source: BOOK_SLUG,
                source_meta: {
                    [BOOK_SLUG]: {
                        level: lvlGroup.level,
                        rank: w.num_sort,
                        id_book: w.id_book,
                        id_word: w.id_word,
                    }
                },
                collocations: collocations,
                definition_jp: definition_jp,
            });
        });
    });
});

fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2));
console.log(`Successfully extracted ${extracted.length} words to ${outputPath}`);
