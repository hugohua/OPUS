'use server';

/**
 * Drive 播放列表 Server Action (V3)
 * 
 * V3 变更：
 *   - 支持 5 种复习模式 (ReviewModeId)，通过 slots 比例动态分配各队列数量
 *   - 支持 batchSize 选词数量 (30/50/100)
 *   - 移除分页逻辑 (cursor/hasMore)，一次性加载后循环播放
 *   - 所有数据源随机化，避免每次听到相同内容
 */

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { getStratifiedNewWords } from '@/lib/services/omps-core';
import { mapToDriveItem } from '@/lib/utils/drive-mapper';

const log = createLogger('actions:drive');

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
import {
    DriveItem,
    DriveMode,
    DriveTrack,
    DrivePlaylistResponse,
    DrivePlaylistOptions,
    DRIVE_VOICE_CONFIG,
    DRIVE_VOICE_SPEED_PRESETS
} from '@/lib/constants/drive';
import {
    ReviewModeId,
    BatchSize,
    REVIEW_MODES,
    DEFAULT_BATCH_SIZE
} from '@/lib/constants/review-modes';

// ------------------------------------------------------------------
// 主入口: 生成播放列表 (V3 - 模式 + 数量驱动)
// ------------------------------------------------------------------
export async function generateDrivePlaylist(
    options: DrivePlaylistOptions = {}
): Promise<DrivePlaylistResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    const userId = session.user.id;

    // 解构参数，设置默认值
    const track: DriveTrack = options.track || 'VISUAL';
    const mode: ReviewModeId = options.mode || 'SANDWICH';
    const batchSize: number = options.batchSize || DEFAULT_BATCH_SIZE;
    const config = REVIEW_MODES[mode];

    // 根据 slots 比例计算各队列数量（最大槽位用减法兜底，防止 Math.round 总和漂移）
    const warmupCount = Math.round(batchSize * config.slots.warmup);
    const weakCount = Math.round(batchSize * config.slots.weak);
    const newWordCount = Math.round(batchSize * config.slots.newWord);
    const phraseCount = Math.round(batchSize * config.slots.phrase);
    const reviewCount = batchSize - warmupCount - weakCount - newWordCount - phraseCount;

    log.info({ userId, track, mode, batchSize, warmupCount, reviewCount, weakCount, newWordCount, phraseCount }, 'Generating playlist V3');

    // ✅ Transaction: 确保所有查询在同一快照下执行
    const fetchResults = await db.$transaction(async (tx) => {
        const results: DriveItem[] = [];
        const seenVocabIds = new Set<number>();

        // 1. Warmup (高稳定度暖身词)
        if (warmupCount > 0) {
            const items = await fetchWarmupItems(userId, warmupCount, track, tx);
            for (const item of items) {
                const vid = parseInt(item.id);
                if (!isNaN(vid)) seenVocabIds.add(vid);
            }
            results.push(...items);
        }

        // 2. Review (SRS 到期复习词)
        if (reviewCount > 0) {
            const items = await fetchReviewItems(userId, reviewCount, track, tx, seenVocabIds);
            for (const item of items) {
                const vid = parseInt(item.id);
                if (!isNaN(vid)) seenVocabIds.add(vid);
            }
            results.push(...items);
        }

        // 3. Weak (低稳定度薄弱词)
        if (weakCount > 0) {
            const items = await fetchWeakItems(userId, weakCount, track, tx, seenVocabIds);
            for (const item of items) {
                const vid = parseInt(item.id);
                if (!isNaN(vid)) seenVocabIds.add(vid);
            }
            results.push(...items);
        }

        // 4. New Words (未学新词 - 仅曝光)
        if (newWordCount > 0) {
            const items = await fetchNewWords(userId, newWordCount, tx, seenVocabIds);
            results.push(...items);
        }

        // 5. Phrases (搭配短语)
        if (phraseCount > 0) {
            const items = await fetchBreakChunks(userId, phraseCount, tx);
            results.push(...items);
        }

        return results;
    });

    // DJ Shuffle (难度穿插)
    const items = opusDjShuffle(fetchResults);

    log.info({
        total: items.length,
        mode,
        batchSize,
        track,
    }, 'Generated playlist V3');

    return { items, track, mode };
}

// ------------------------------------------------------------------
// Sub-Routines
// ------------------------------------------------------------------

/**
 * 🥪 Warmup: 高稳定度暖身词
 * 从稳定度最高的池子中随机采样，建立信心
 */
async function fetchWarmupItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db
): Promise<DriveItem[]> {
    // 扩大候选池，再随机采样
    const poolSize = Math.max(limit * 5, 30);
    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            stability: { gt: 1 },
        },
        include: { vocab: true },
        orderBy: { stability: 'desc' },
        take: poolSize,
    });

    // ✅ Fail-Safe: 如果没有 stability > 1 的记录，降级为任何已复习的词
    if (records.length === 0) {
        log.warn({ track }, 'No stability > 1 records, falling back to any reviewed words');
        const fallback = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: { not: 'NEW' }
            },
            include: { vocab: true },
            orderBy: { last_review_at: 'desc' },
            take: limit
        });

        return shuffleArray(fallback).slice(0, limit).map(r => ({
            ...mapToDriveItem(r.vocab, 'QUIZ', 'warmup'),
            stability: r.stability || 0.1
        }));
    }

    // 随机采样
    return shuffleArray(records).slice(0, limit).map(r => ({
        ...mapToDriveItem(r.vocab, 'QUIZ', 'warmup'),
        stability: r.stability
    }));
}

/**
 * 📚 Review: SRS 到期复习词
 * 严格按到期时间排序（这是正确的 SRS 行为），fallback 加随机偏移
 */
async function fetchReviewItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    const excludeArray = Array.from(excludeIds);

    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            next_review_at: { lte: new Date() },
            ...(excludeArray.length > 0 ? { vocabId: { notIn: excludeArray } } : {}),
        },
        include: { vocab: true },
        orderBy: { next_review_at: 'asc' },
        take: limit,
    });

    // Fallback: 到期词不够时，从 REVIEW/MASTERED 中随机补齐
    if (records.length < limit) {
        const needed = limit - records.length;
        const existingIds = [...excludeArray, ...records.map(r => r.vocabId)];

        // 统计可补齐的总量，用于随机偏移
        const pool = await client.userProgress.count({
            where: {
                userId,
                track,
                status: { in: ['REVIEW', 'MASTERED'] },
                vocabId: { notIn: existingIds }
            }
        });
        const maxSkip = Math.max(0, pool - needed);
        const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

        const extra = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: { in: ['REVIEW', 'MASTERED'] },
                vocabId: { notIn: existingIds }
            },
            include: { vocab: true },
            orderBy: { next_review_at: 'asc' },
            skip: randomSkip,
            take: needed
        });
        records.push(...extra);
    }

    return records.map(r => ({
        ...mapToDriveItem(r.vocab, 'QUIZ', 'review'),
        stability: r.stability
    }));
}

/**
 * 🔧 Weak: 低稳定度薄弱词 (WEAK_REPAIR 模式专用)
 * 按 stability ASC 排序，优先修复最弱的词
 */
async function fetchWeakItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    const excludeArray = Array.from(excludeIds);

    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            status: { not: 'NEW' },
            ...(excludeArray.length > 0 ? { vocabId: { notIn: excludeArray } } : {}),
        },
        include: { vocab: true },
        orderBy: { stability: 'asc' }, // 最弱的优先
        take: limit,
    });

    return records.map(r => ({
        ...mapToDriveItem(r.vocab, 'QUIZ', 'review'),
        stability: r.stability
    }));
}

/**
 * 🆕 New Words: 未学新词 (DISCOVERY 模式曝光用)
 * [V3] 复用 OMPS getStratifiedNewWords 分层采样
 * ⚠️ 仅曝光，不会修改 FSRS 状态
 */
async function fetchNewWords(
    userId: string,
    limit: number,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    try {
        const candidates = await getStratifiedNewWords(
            userId,
            limit,
            Array.from(excludeIds)
        );

        return candidates.map(c => ({
            ...mapToDriveItem({
                id: c.vocabId,
                word: c.word,
                definition_cn: c.definition_cn,
                phoneticUs: c.phoneticUs || null,
                commonExample: c.commonExample,
                scenarios: [],
                frequency_score: c.frequency_score,
            } as any, 'QUIZ', 'review'),
            stability: 0 // 新词无稳定度
        }));
    } catch (e) {
        log.error({ error: e }, 'Failed to fetch new words for DISCOVERY mode');
        return [];
    }
}

/**
 * ☕ Break Chunks: 搭配短语
 * 使用随机偏移避免每次取到相同的 top-N
 */
async function fetchBreakChunks(
    userId: string,
    limit: number,
    client: Prisma.TransactionClient | typeof db = db
): Promise<DriveItem[]> {
    // 统计总量，用于随机偏移
    const totalWithCollocations = await client.vocab.count({
        where: { collocations: { not: Prisma.DbNull } }
    });
    const sampleSize = Math.min(20, totalWithCollocations);
    const maxSkip = Math.max(0, totalWithCollocations - sampleSize);
    const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

    const vocabs = await client.vocab.findMany({
        where: {
            collocations: { not: Prisma.DbNull }
        },
        select: {
            id: true,
            collocations: true,
            word: true,
            phoneticUs: true,
            definition_cn: true,
            scenarios: true
        },
        skip: randomSkip,
        take: sampleSize,
        orderBy: { frequency_score: 'desc' }
    });

    if (vocabs.length === 0) {
        log.warn('No vocabs with collocations found');
        return [];
    }

    // 收集所有合法搭配，再随机采样
    const allChunks: DriveItem[] = [];
    for (const v of vocabs) {
        if (!v.collocations || !Array.isArray(v.collocations)) continue;

        const validCols = (v.collocations as any[]).filter((c: any) => c.text && c.text.split(' ').length > 1);

        for (const col of validCols) {
            allChunks.push({
                id: `chunk-${v.id}-${Math.random()}`,
                text: col.text,
                trans: col.trans || v.definition_cn || '暂无翻译',
                phonetic: '',
                word: v.word,
                ttsPhrase: col.text,
                pos: 'phrase',
                meaning: v.definition_cn || '',
                scenarios: v.scenarios,
                stability: undefined,
                mode: 'WASH',
                voice: DRIVE_VOICE_CONFIG.WASH_PHRASE,
                speed: DRIVE_VOICE_SPEED_PRESETS[DRIVE_VOICE_CONFIG.WASH_PHRASE] || 1.0
            });
        }
    }

    // 随机采样 limit 个
    return shuffleArray(allChunks).slice(0, limit);
}

// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Opus DJ Shuffle Algorithm
// 难度穿插，避免认知干扰
// ------------------------------------------------------------------
function opusDjShuffle(items: DriveItem[]): DriveItem[] {
    if (items.length === 0) return items;

    const easy = items.filter(i => (i.stability || 0) > 10 && i.mode === 'QUIZ');
    const hard = items.filter(i => (i.stability || 0) <= 10 && i.mode === 'QUIZ');
    const chunks = items.filter(i => i.mode === 'WASH');
    const story = items.filter(i => i.mode === 'STORY');

    log.debug({ easy: easy.length, hard: hard.length, chunks: chunks.length, story: story.length }, 'DJ Shuffle layering');

    // 难度穿插 (三明治模式: E-H-H-E-C)
    const result: DriveItem[] = [];

    while (easy.length || hard.length || chunks.length || story.length) {
        if (easy.length) result.push(easy.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (easy.length) result.push(easy.shift()!);
        if (chunks.length) result.push(chunks.shift()!);
        if (story.length) result.push(story.shift()!);
    }

    log.debug({ count: result.length }, 'DJ Shuffle result');
    return result;
}

// ------------------------------------------------------------------
// Utils
// ------------------------------------------------------------------

/** Fisher-Yates 洗牌算法 */
function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
