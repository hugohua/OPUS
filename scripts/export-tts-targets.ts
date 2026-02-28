/**
 * 离线 TTS 目标提取脚本 (TTS Targets Exporter)
 * ==============================================
 * 
 * 功能:
 *   扫描核心业务表 (Vocab, SmartContent, QuestionSeed)，提取所有需要发音的英语文本。
 *   复用前端的 MD5 Hash 算法 (lib/tts/hash.ts)，对比 TTSCache 表自动过滤已有缓存，
 *   只导出缺失的音频目标。
 * 
 * 使用方法:
 *   npx tsx scripts/export-tts-targets.ts
 * 
 * 输出:
 *   output/tts_targets.json  —— 结构: [{ text, hash, sourceTable }]
 * 
 * 下一步 (配合 Edge-TTS 批量生成):
 *   cd python_tts_service && source venv/bin/activate
 *   python batch_edge_tts.py --file "../output/tts_targets.json" --lang "en-US" --concurrency 3
 *
 * 扫描范围:
 *   - Vocab.word              单词发音
 *   - Vocab.collocations[]    搭配短语发音
 *   - SmartContent.payload    L2 例句 / L0 搭配扩展
 *   - QuestionSeed.sentence   题干发音
 *   - QuestionSeed.options[]  选项发音
 * 
 * 断点续传:
 *   反复执行本脚本是安全的，已缓存的 Hash 会被自动跳过。
 * 
 * 相关文档:
 *   docs/dev-notes/edge-tts-offline-generation.md
 */

import { PrismaClient } from '@prisma/client';
import { generateAudioHash } from '../lib/tts/hash';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../lib/logger';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('export-tts');
const prisma = new PrismaClient();

// 默认的发音参数，这里必须和我们要生成的要求一致，这也是 Opus 默认的获取参数
const DEFAULT_VOICE = 'Cherry';
const DEFAULT_LANG = 'en-US';
const DEFAULT_SPEED = 1.0;

interface TTSTarget {
    text: string;
    hash: string;
    sourceTable: string;
}

// Memory tracking array
let allTargets: TTSTarget[] = [];
// Hash Set for deduplication within the same run
const pendingHashes = new Set<string>();

function addTarget(text: string, sourceTable: string, cacheSet: Set<string>) {
    if (!text || typeof text !== 'string') return;

    // Some minor whitespace trimming for valid data, but keep internal spaces intact for hash fidelity
    const cleanText = text.trim();
    if (cleanText.length === 0) return;

    // Calculate Hash using identical algorithm from frontend
    const hash = generateAudioHash({
        text: cleanText,
        voice: DEFAULT_VOICE,
        language: DEFAULT_LANG,
        speed: DEFAULT_SPEED
    });

    // 1. 如果现有的 TTSCache 中已有此音频，过滤
    if (cacheSet.has(hash)) return;

    // 2. 如果本次 run 已经添加过该 hash，过滤 (防止重复)
    if (pendingHashes.has(hash)) return;

    pendingHashes.add(hash);
    allTargets.push({
        text: cleanText,
        hash,
        sourceTable
    });
}

async function main() {
    log.info('Starting TTS targets extraction...');

    // 1. 预加载所有现有的 TTSCache Hash 列表，加速对比
    log.info('Fetching existing TTSCache IDs...');
    const existingCache = await prisma.tTSCache.findMany({ select: { id: true } });
    const cacheSet = new Set(existingCache.map(c => c.id));
    log.info(`Found ${cacheSet.size} existing cached audio records.`);

    // ============================================
    // 2. 扫描 Vocab 表，找单词、例句、词组
    // ============================================
    log.info('Scanning Vocab table...');
    const vocabs = await prisma.vocab.findMany({
        select: {
            word: true,
            collocations: true
        }
    });

    for (const v of vocabs) {
        // - 单词发音
        addTarget(v.word, 'Vocab.word', cacheSet);

        // - Collocations 搭配发音
        if (v.collocations && Array.isArray(v.collocations)) {
            v.collocations.forEach((col: any) => {
                if (col.text) addTarget(col.text, 'Vocab.collocations', cacheSet);
            });
        }
    }
    log.info(`After Vocab: Added ${allTargets.length} targets.`);

    // ============================================
    // 3. 扫描 SmartContent 表 (重头戏 L2 Sentences)
    // ============================================
    log.info('Scanning SmartContent table...');
    const smartContents = await prisma.smartContent.findMany({
        where: {
            type: { in: ['L2_SENTENCE', 'L0_COLLOCATION'] }
        },
        select: {
            payload: true,
            type: true
        }
    });

    for (const sc of smartContents) {
        if (sc.payload && typeof sc.payload === 'object') {
            const payloadObj = sc.payload as any;
            if (payloadObj.text) {
                addTarget(payloadObj.text, `SmartContent.${sc.type}`, cacheSet);
            }
        }
    }
    log.info(`After SmartContent: Accumulated ${allTargets.length} targets.`);

    // ============================================
    // 4. 扫描 QuestionSeed 表 (听力 / 阅读等选项)
    // ============================================
    log.info('Scanning QuestionSeed table (Part 1,2,3,4,5,6)...');
    const questionSeeds = await prisma.questionSeed.findMany({
        select: {
            sentence: true,
            options: true
        }
    });

    for (const q of questionSeeds) {
        if (q.sentence) {
            addTarget(q.sentence, 'QuestionSeed.sentence', cacheSet);
        }

        if (q.options && Array.isArray(q.options)) {
            q.options.forEach((opt: any) => {
                if (opt.text) {
                    addTarget(opt.text, 'QuestionSeed.options', cacheSet);
                }
            });
        }
    }
    log.info(`After QuestionSeed: Accumulated ${allTargets.length} targets.`);

    // ============================================
    // 5. 导出结果
    // ============================================
    if (allTargets.length === 0) {
        log.info('🎉 All required texts are already cached! No new targets to export.');
        return;
    }

    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'tts_targets.json');
    log.info(`Writing ${allTargets.length} targets to ${outputPath}...`);

    await fs.writeFile(
        outputPath,
        JSON.stringify(allTargets, null, 2),
        'utf-8'
    );

    log.info('='.repeat(50));
    log.info(`Extraction complete! Total missing audios: ${allTargets.length}`);
    log.info('To process these, run the following python command:');
    log.info(`cd python_tts_service && source venv/bin/activate`);
    log.info(`python batch_edge_tts.py --file "../output/tts_targets.json" --lang "en-US" --concurrency 3`);
    log.info('='.repeat(50));
}

main()
    .catch((e) => {
        log.error({ error: e }, 'Fatal error during TTS target extraction');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
